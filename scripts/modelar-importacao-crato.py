#!/usr/bin/env python3
"""Modela os CSVs do orcamento HUV Crato para o importador atual.

Os CSVs de origem sao preservados. O script gera um pacote derivado com
composicoes somente usadas pelo PO (incluindo referencias transitivas),
orcamento em JSON interno e manifesto de validacao.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
import uuid
from collections import defaultdict, deque
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sprints/ref/Orçamentos e Medições Crato"
OUT = SOURCE / "importacao-modelada"
NAMESPACE = uuid.UUID("f80e7e83-4e38-4a1a-a8b7-cb2f13fc4f6c")

PO = SOURCE / "Orçamento Crato - PO.csv"
SINAPI = SOURCE / "Orçamento Crato - SINAPI-ANALITICO.csv"
NOVAS = SOURCE / "Orçamento Crato - COMPOSICOES NOVAS.csv"


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\ufeff", "").strip())


def key(value: str | None) -> str:
    return unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode().lower()


def number(value: str | None) -> float | None:
    text = clean(value)
    if not text or text in {"#NAME?", "N/D", "-"}:
        return None
    text = text.replace("R$", "").replace("%", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(Decimal(text))
    except (InvalidOperation, ValueError) as error:
        raise ValueError(f"numero invalido: {value!r}") from error


def money(value: str | None) -> float:
    return number(value) or 0.0


def rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.reader(handle))


def find_header(data: list[list[str]], required: set[str]) -> tuple[int, list[str]]:
    wanted = {key(item) for item in required}
    for index, row in enumerate(data):
        normalized = {key(cell) for cell in row}
        if wanted.issubset(normalized):
            return index, row
    raise ValueError(f"Cabecalho nao encontrado: {sorted(required)}")


def columns(header: list[str]) -> dict[str, int]:
    return {key(value): index for index, value in enumerate(header)}


def cell(row: list[str], indexes: dict[str, int], name: str) -> str:
    index = indexes.get(key(name), -1)
    return row[index] if 0 <= index < len(row) else ""


def source_code(source: str, code: str) -> str:
    return f"{clean(source).upper()}:{clean(code)}"


def stable_id(*parts: object) -> str:
    return str(uuid.uuid5(NAMESPACE, "|".join(clean(str(part)) for part in parts)))


def category(value: str) -> str:
    normalized = key(value)
    if any(token in normalized for token in ("mobra", "mao de obra", "mao-de-obra", "encargo")):
        return "mao_de_obra"
    if any(token in normalized for token in ("equip", "chp", "chi")):
        return "equipamento"
    if any(token in normalized for token in ("material", "insumo")):
        return "material"
    return "outro"


def round4(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def main() -> None:
    po_data = rows(PO)
    po_header_at, po_header = find_header(po_data, {"Bloco", "CÓDIGO", "DISCRIMINAÇÃO DO SERVIÇO"})
    po_cols = columns(po_header)
    po_records = po_data[po_header_at + 1 :]

    sinapi_data = rows(SINAPI)
    sinapi_header_at, sinapi_header = find_header(sinapi_data, {"CODIGO DA COMPOSICAO", "CODIGO ITEM", "COEFICIENTE"})
    sinapi_cols = columns(sinapi_header)
    sinapi_records = sinapi_data[sinapi_header_at + 1 :]

    novas_data = rows(NOVAS)
    novas_header_at, novas_header = find_header(novas_data, {"CODIGO DA COMPOSICAO", "TIPO ITEM", "COEFICIENTE"})
    novas_cols = columns(novas_header)
    novas_records = novas_data[novas_header_at + 1 :]

    po_lines: list[dict] = []
    roots: set[str] = set()
    blank_code_lines = 0
    for ordinal, row in enumerate(po_records, 1):
        marker = clean(cell(row, po_cols, "Bloco")).upper()
        if marker not in {"HEAD1", "HEAD2", "HEAD3"}:
            continue
        source = clean(cell(row, po_cols, "FONTE")).upper()
        code = clean(cell(row, po_cols, "CÓDIGO"))
        description = clean(cell(row, po_cols, "DISCRIMINAÇÃO DO SERVIÇO"))
        item_number = clean(cell(row, po_cols, "ITEM"))
        if marker == "HEAD3" and not code:
            blank_code_lines += 1
        namespaced = source_code(source, code) if code else ""
        if marker == "HEAD3" and namespaced:
            roots.add(namespaced)
        po_lines.append({
            "ordinal_origem": ordinal,
            "marker": marker,
            "item": item_number,
            "fonte": source,
            "codigo_original": code,
            "codigo": namespaced or None,
            "descricao": description,
            "unidade": clean(cell(row, po_cols, "UN")),
            "quantidade": number(cell(row, po_cols, "QUANT.")) or 0,
            "valor_unitario": money(cell(row, po_cols, "VALOR UNITÁRIO")),
            "valor_total": money(cell(row, po_cols, "VALOR TOTAL")),
            "valor_com_bdi": money(cell(row, po_cols, "VALOR COM BDI")),
        })

    raw_compositions: dict[str, dict] = {}
    references: list[dict] = []

    def add_parent(source: str, code: str, name: str, unit: str, origin: str) -> dict:
        namespaced = source_code(source, code)
        if namespaced not in raw_compositions:
            raw_compositions[namespaced] = {
                "codigo": namespaced,
                "codigo_original": clean(code),
                "fonte": clean(source).upper(),
                "nome": clean(name) or namespaced,
                "unidade": clean(unit) or "un",
                "componentes": [],
                "origem_arquivo": origin,
            }
        return raw_compositions[namespaced]

    for row in sinapi_records:
        code = clean(cell(row, sinapi_cols, "CODIGO DA COMPOSICAO"))
        if not code:
            continue
        parent = add_parent("SINAPI", code, cell(row, sinapi_cols, "DESCRICAO DA COMPOSICAO"), cell(row, sinapi_cols, "UNIDADE"), SINAPI.name)
        item_code = clean(cell(row, sinapi_cols, "CODIGO ITEM"))
        item_name = clean(cell(row, sinapi_cols, "DESCRIÇÃO ITEM"))
        if not item_code or not item_name:
            continue
        item_type = clean(cell(row, sinapi_cols, "TIPO ITEM"))
        item_source = clean(cell(row, sinapi_cols, "ORIGEM DE PREÇO ITEM")).upper() or "SINAPI"
        component = {
            "codigo": clean(item_code),
            "nome": item_name,
            "categoria": category(item_type),
            "unidade": clean(cell(row, sinapi_cols, "UNIDADE ITEM")) or "un",
            "quantidade": number(cell(row, sinapi_cols, "COEFICIENTE")) or 0,
            "custoUnitario": money(cell(row, sinapi_cols, "PRECO UNITARIO")),
        }
        if key(item_type) == "composicao":
            reference = source_code(item_source, item_code)
            component["composicaoReferenciaCodigo"] = reference
            references.append({"pai": parent["codigo"], "filha": reference, "quantidade": component["quantidade"], "fonte": "SINAPI"})
        parent["componentes"].append(component)

    for row in novas_records:
        marker = clean(cell(row, novas_cols, "LETRA")).upper()
        code = clean(cell(row, novas_cols, "CODIGO DA COMPOSICAO"))
        if not code:
            continue
        source = clean(cell(row, novas_cols, "FONTE")).upper() or "UFCA"
        parent = add_parent(source, code, cell(row, novas_cols, "DESCRICAO DA COMPOSICAO"), cell(row, novas_cols, "UN"), NOVAS.name)
        if marker != "HEAD3" and not clean(cell(row, novas_cols, "CODIGO ITEM")):
            continue
        item_code = clean(cell(row, novas_cols, "CODIGO ITEM"))
        item_name = clean(cell(row, novas_cols, "DESCRIÇÃO ITEM"))
        if not item_code or not item_name:
            continue
        reference_source = clean(cell(row, novas_cols, "REFERÊNCIA")).upper()
        item_type = clean(cell(row, novas_cols, "TIPO ITEM"))
        component = {
            "codigo": item_code,
            "nome": item_name,
            "categoria": category(item_type),
            "unidade": clean(cell(row, novas_cols, "UNIDADE")) or "un",
            "quantidade": number(cell(row, novas_cols, "COEFICIENTE")) or 0,
            "custoUnitario": money(cell(row, novas_cols, "PRECO UNITARIO")),
        }
        if key(item_type) == "composicao" or reference_source in {"UFCA", "SINAPI", "SEINFRA", "ORSE", "EMOP-RJ", "SEDOP-PA", "PP"} and key(item_type) not in {"insumo", "mobra"}:
            reference = source_code(reference_source or source, item_code)
            component["composicaoReferenciaCodigo"] = reference
            references.append({"pai": parent["codigo"], "filha": reference, "quantidade": component["quantidade"], "fonte": "COMPOSICOES NOVAS"})
        parent["componentes"].append(component)

    resolvable_references = [item for item in references if item["filha"] in raw_compositions]
    pending_external_references = sorted({item["filha"] for item in references if item["pai"] in roots and item["filha"] not in raw_compositions})
    selected = set(roots)
    queue = deque(roots)
    while queue:
        current = queue.popleft()
        for reference in resolvable_references:
            if reference["pai"] == current and reference["filha"] in raw_compositions and reference["filha"] not in selected:
                selected.add(reference["filha"])
                queue.append(reference["filha"])

    compositions = []
    for code in sorted(selected):
        item = raw_compositions[code]
        clean_components = []
        for component in item["componentes"]:
            component = dict(component)
            component.pop("composicaoReferenciaCodigo", None)
            clean_components.append(component)
        custo = round4(sum(component["quantidade"] * component["custoUnitario"] for component in clean_components))
        compositions.append({"codigo": item["codigo"], "nome": item["nome"], "unidade": item["unidade"], "custoUnitarioCalculado": custo, "componentes": clean_components})

    columns_json = [
        {"id": "codigo", "nome": "Código", "tipo": "texto", "selecionada": True, "funcao": "codigo"},
        {"id": "descricao", "nome": "Descrição", "tipo": "texto", "selecionada": True, "funcao": "descricao"},
        {"id": "unidade", "nome": "Unidade", "tipo": "texto", "selecionada": True, "funcao": "unidade"},
        {"id": "quantidade", "nome": "Quantidade", "tipo": "numero", "selecionada": True, "funcao": "quantidade"},
        {"id": "valor_unitario", "nome": "Valor unitário sem BDI", "tipo": "moeda", "selecionada": True, "funcao": "valor_unitario"},
        {"id": "valor_total", "nome": "Valor total sem BDI", "tipo": "moeda", "selecionada": True, "funcao": "valor_total"},
        {"id": "valor_com_bdi", "nome": "Valor total com BDI", "tipo": "moeda", "selecionada": True},
        {"id": "fonte", "nome": "Fonte", "tipo": "texto", "selecionada": True, "funcao": "fonte"},
    ]
    budget_lines = []
    item_map = []
    current_group = None
    for line in po_lines:
        if line["marker"] in {"HEAD1", "HEAD2"}:
            current_group = line["descricao"] or line["item"] or "Grupo sem nome"
        item_type = "item" if line["marker"] == "HEAD3" else "grupo"
        item_id = stable_id("HUV Crato", line["marker"], line["ordinal_origem"], line["item"], line["codigo_original"], line["descricao"])
        budget_line = {
            "__item_id": item_id,
            "__tipo": item_type,
            "__grupo": current_group,
            "__aba": "PO",
            "codigo": line["codigo"],
            "descricao": line["descricao"],
            "unidade": line["unidade"],
            "quantidade": line["quantidade"],
            "valor_unitario": line["valor_unitario"],
            "valor_total": line["valor_total"],
            "valor_com_bdi": line["valor_com_bdi"],
            "fonte": line["fonte"],
            "__dados_origem": {"item": line["item"], "codigo_original": line["codigo_original"], "linha_origem": line["ordinal_origem"]},
        }
        budget_lines.append(budget_line)
        item_map.append({"chave_estavel": item_id, "codigo": line["codigo"] or "", "codigo_original": line["codigo_original"], "descricao": line["descricao"], "ordem": len(budget_lines), "tipo": item_type, "folha_mensuravel": item_type == "item" and bool(line["codigo"] and line["unidade"] and line["quantidade"] is not None)})

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "composicoes.normalizadas.json").write_text(json.dumps({"obra": "HUV Crato", "composicoes": compositions}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "composicoes.referencias.json").write_text(json.dumps({"referencias": [item for item in references if item["pai"] in selected]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "orcamento.normalizado.json").write_text(json.dumps({"nome": "Orçamento HUV Crato - PO", "colunas": columns_json, "linhas": budget_lines}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (OUT / "orcamento.item-map.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=item_map[0].keys())
        writer.writeheader()
        writer.writerows(item_map)

    source_hash = hashlib.sha256(PO.read_bytes() + SINAPI.read_bytes() + NOVAS.read_bytes()).hexdigest()
    package_hash = hashlib.sha256(
        (OUT / "composicoes.normalizadas.json").read_bytes()
        + (OUT / "composicoes.referencias.json").read_bytes()
        + (OUT / "orcamento.normalizado.json").read_bytes()
    ).hexdigest()
    warnings = []
    if blank_code_lines:
        warnings.append(f"{blank_code_lines} linha(s) HEAD3 do PO sem codigo original")
    if pending_external_references:
        warnings.append(f"{len(pending_external_references)} referencia(s) externa(s) preservada(s) como componente precificado; nao ha composicao filha no snapshot fornecido")
    manifesto = {
        "obra": "HUV Crato",
        "arquivos_origem": [PO.name, SINAPI.name, NOVAS.name],
        "sha256_conjunto": source_hash,
        "sha256_pacote": package_hash,
        "encoding": "UTF-8",
        "delimitador": ",",
        "po": {"linhas_modeladas": len(po_lines), "itens": sum(item["tipo"] == "item" for item in item_map), "grupos": sum(item["tipo"] == "grupo" for item in item_map), "linhas_sem_codigo": blank_code_lines},
        "composicoes": {"raizes_no_po": len(roots), "selecionadas_com_transitivas": len(compositions), "componentes": sum(len(item["componentes"]) for item in compositions), "referencias_resolvidas": len([item for item in resolvable_references if item["pai"] in selected]), "referencias_externas_preservadas": pending_external_references},
        "limites_importador": {"max_composicoes": 5000, "max_componentes_por_composicao": 500, "max_linhas_orcamento": 3000},
        "avisos": warnings,
        "status": "BLOQUEADO" if len(compositions) > 5000 else "PRONTO_PARA_CARGA_CONTROLADA",
        "bloqueio_operacional": "O importador atual grava apenas o codigo textual do componente. Referencias internas listadas em composicoes.referencias.json precisam ser resolvidas para composicao_referencia_id antes do calculo recursivo e da aplicacao de custos.",
        "ordem_carga": ["composicoes.normalizadas.json", "resolver composicaoReferenciaCodigo em composicao_componentes", "orcamento.normalizado.json", "reconciliar orcamento.item-map.csv com orcamento_itens.id", "criar catalogo_precos e vinculos de medicao"],
    }
    (OUT / "manifesto-validacao.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"saida": str(OUT), "status": manifesto["status"], "composicoes": len(compositions), "linhas_orcamento": len(budget_lines), "referencias_externas": len(pending_external_references)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
