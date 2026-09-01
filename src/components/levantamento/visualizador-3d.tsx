"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  Download,
  Eye,
  EyeOff,
  FileText,
  Rotate3d,
} from "lucide-react";
import { LegendaDinamica } from "./legenda-dinamica";
import {
  baixarDataUrl,
  exportarParaPdfViaImpressao,
} from "@/lib/levantamento/exportacao";
import type {
  ConfigLegenda,
  ItemLevantamento,
  Nivel3D,
  ResumoLevantamento,
} from "@/lib/levantamento/tipos";

interface Visualizador3DProps {
  itens: ItemLevantamento[];
  resumo: ResumoLevantamento;
  niveis: Nivel3D[];
  configLegenda: ConfigLegenda;
  aoMudarConfigLegenda: (config: ConfigLegenda) => void;
  larguraPdf: number;
  alturaPdf: number;
  canvasPlanta2D: HTMLCanvasElement | null;
  obraNome: string;
  plantaNome: string;
  pagina: number;
}

export function Visualizador3D({
  itens,
  resumo,
  niveis,
  configLegenda,
  aoMudarConfigLegenda,
  larguraPdf,
  alturaPdf,
  canvasPlanta2D,
  obraNome,
  plantaNome,
  pagina,
}: Visualizador3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [apenasMarcacoes, setApenasMarcacoes] = useState(false);
  const [mostrarGrid, setMostrarGrid] = useState(true);
  const [escalaVertical, setEscalaVertical] = useState(1.5);
  const [vistaAtual, setVistaAtual] = useState<string>("iso_ne");

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const plantaMeshRef = useRef<THREE.Mesh | null>(null);
  const niveisGroupRef = useRef<THREE.Group | null>(null);

  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const sphericalRef = useRef({
    radius: 800,
    theta: Math.PI / 4,
    phi: Math.PI / 6,
  });
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  const atualizarPosicaoCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const target = targetRef.current;

    const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
    cameraRef.current.updateProjectionMatrix();

    if (rendererRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  const definirVista = useCallback((tipo: string) => {
    setVistaAtual(tipo);
    targetRef.current.set(0, 0, 0);

    switch (tipo) {
      case "iso_ne":
        sphericalRef.current = { radius: 800, theta: Math.PI / 4, phi: Math.PI / 3.5 };
        break;
      case "iso_nw":
        sphericalRef.current = { radius: 800, theta: -Math.PI / 4, phi: Math.PI / 3.5 };
        break;
      case "iso_se":
        sphericalRef.current = { radius: 800, theta: (3 * Math.PI) / 4, phi: Math.PI / 3.5 };
        break;
      case "iso_sw":
        sphericalRef.current = { radius: 800, theta: -(3 * Math.PI) / 4, phi: Math.PI / 3.5 };
        break;
      case "topo":
        sphericalRef.current = { radius: 800, theta: 0, phi: 0.001 };
        break;
      case "frente":
        sphericalRef.current = { radius: 800, theta: 0, phi: Math.PI / 2.05 };
        break;
    }
    atualizarPosicaoCamera();
  }, [atualizarPosicaoCamera]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#090d16");
    sceneRef.current = scene;

    const aspect = width / height;
    const frustumSize = 700;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      5000,
    );
    camera.zoom = 1;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(300, 600, 400);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
    dirLight2.position.set(-300, -200, -400);
    scene.add(dirLight2);

    const wPdf = larguraPdf || 842;
    const hPdf = alturaPdf || 595;
    const aspectoPdf = hPdf / wPdf;
    const tamanhoPlano = 500;
    const alturaPlano = tamanhoPlano * aspectoPdf;

    if (canvasPlanta2D) {
      const textura = new THREE.CanvasTexture(canvasPlanta2D);
      textura.colorSpace = THREE.SRGBColorSpace;
      const matPlanta = new THREE.MeshBasicMaterial({
        map: textura,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: apenasMarcacoes ? 0.05 : 0.9,
      });
      const geoPlanta = new THREE.PlaneGeometry(tamanhoPlano, alturaPlano);
      const meshPlanta = new THREE.Mesh(geoPlanta, matPlanta);
      meshPlanta.rotation.x = -Math.PI / 2;
      meshPlanta.position.y = 0;
      scene.add(meshPlanta);
      plantaMeshRef.current = meshPlanta;
    }

    if (mostrarGrid && !apenasMarcacoes) {
      const gridBase = new THREE.GridHelper(
        Math.max(tamanhoPlano, alturaPlano) * 1.3,
        20,
        0x0284c7,
        0x1e293b,
      );
      gridBase.position.y = -0.5;
      scene.add(gridBase);
    }

    const niveisGroup = new THREE.Group();
    niveisGroupRef.current = niveisGroup;
    scene.add(niveisGroup);

    const escalaMetrosPara3D = 60 * escalaVertical;

    if (mostrarGrid && !apenasMarcacoes) {
      niveis.forEach((n) => {
        const yNivel = n.cota * escalaMetrosPara3D;
        const gridNivel = new THREE.GridHelper(
          Math.max(tamanhoPlano, alturaPlano) * 1.1,
          10,
          new THREE.Color(n.cor),
          new THREE.Color(n.cor).multiplyScalar(0.2),
        );
        gridNivel.position.y = yNivel;
        niveisGroup.add(gridNivel);
      });
    }

    function converterCoords2DPara3D(p: { x: number; y: number }, cotaM = 0) {
      const xNorm = (p.x / wPdf - 0.5) * tamanhoPlano;
      const zNorm = -((p.y / hPdf - 0.5) * alturaPlano);
      const y3D = cotaM * escalaMetrosPara3D;
      return new THREE.Vector3(xNorm, y3D, zNorm);
    }

    itens.forEach((item) => {
      const corThree = new THREE.Color(item.cor);

      if (item.tipo === "ponto") {
        const cota = item.altura ?? 0.3;
        const p1 = item.pontos[0] ?? { x: 0, y: 0 };
        const pos = converterCoords2DPara3D(p1, cota);

        const geo = new THREE.BoxGeometry(10, 8, 10);
        const mat = new THREE.MeshStandardMaterial({
          color: corThree,
          metalness: 0.2,
          roughness: 0.3,
        });
        const boxMesh = new THREE.Mesh(geo, mat);
        boxMesh.position.copy(pos);
        scene.add(boxMesh);

        const stemGeo = new THREE.CylinderGeometry(0.8, 0.8, pos.y, 8);
        const stemMat = new THREE.MeshBasicMaterial({
          color: corThree,
          transparent: true,
          opacity: 0.6,
        });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(pos.x, pos.y / 2, pos.z);
        scene.add(stem);
      } else if (item.tipo === "distancia" || item.tipo === "tubulacao_cabo") {
        const cota = item.altura ?? 2.8;
        if (item.pontos.length >= 2) {
          const pontos3D = item.pontos.map((pt) =>
            converterCoords2DPara3D(pt, cota),
          );
          const curva = new THREE.CatmullRomCurve3(
            pontos3D,
            false,
            "catmullrom",
            0.0,
          );
          const tubeGeo = new THREE.TubeGeometry(curva, 32, 2.5, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: corThree,
            metalness: 0.4,
            roughness: 0.2,
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          scene.add(tube);

          pontos3D.forEach((p) => {
            const jGeo = new THREE.SphereGeometry(3.5, 8, 8);
            const jMat = new THREE.MeshStandardMaterial({ color: corThree });
            const jMesh = new THREE.Mesh(jGeo, jMat);
            jMesh.position.copy(p);
            scene.add(jMesh);
          });
        }
      } else if (item.tipo === "descida_subida") {
        const p1 = item.pontos[0] ?? { x: 0, y: 0 };
        const altOrigem = item.alturaOrigem ?? 2.8;
        const altDestino = item.alturaDestino ?? 0.3;

        const posAlta = converterCoords2DPara3D(
          p1,
          Math.max(altOrigem, altDestino),
        );
        const posBaixa = converterCoords2DPara3D(
          p1,
          Math.min(altOrigem, altDestino),
        );
        const altCilindro = Math.abs(posAlta.y - posBaixa.y);

        const geoDesc = new THREE.CylinderGeometry(3.5, 3.5, altCilindro, 16);
        const matDesc = new THREE.MeshStandardMaterial({
          color: corThree,
          metalness: 0.6,
          roughness: 0.2,
          emissive: corThree,
          emissiveIntensity: 0.25,
        });
        const meshDesc = new THREE.Mesh(geoDesc, matDesc);
        meshDesc.position.set(
          posAlta.x,
          (posAlta.y + posBaixa.y) / 2,
          posAlta.z,
        );
        scene.add(meshDesc);

        const topoGeo = new THREE.SphereGeometry(4.5, 12, 12);
        const topoMat = new THREE.MeshStandardMaterial({ color: corThree });
        const topoMesh = new THREE.Mesh(topoGeo, topoMat);
        topoMesh.position.copy(posAlta);
        scene.add(topoMesh);

        const baseMesh = new THREE.Mesh(topoGeo, topoMat);
        baseMesh.position.copy(posBaixa);
        scene.add(baseMesh);
      } else if (item.tipo === "area" && item.pontos.length >= 3) {
        const cota = item.altura ?? 0.0;
        const pts3D = item.pontos.map((pt) =>
          converterCoords2DPara3D(pt, cota),
        );

        const shape = new THREE.Shape();
        shape.moveTo(pts3D[0].x, pts3D[0].z);
        for (let i = 1; i < pts3D.length; i++) {
          shape.lineTo(pts3D[i].x, pts3D[i].z);
        }
        shape.closePath();

        const geoShape = new THREE.ShapeGeometry(shape);
        const matShape = new THREE.MeshStandardMaterial({
          color: corThree,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        });
        const meshArea = new THREE.Mesh(geoShape, matShape);
        meshArea.rotation.x = Math.PI / 2;
        meshArea.position.y = cota * escalaMetrosPara3D + 0.5;
        scene.add(meshArea);

        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          ...pts3D,
          pts3D[0],
        ]);
        const lineMat = new THREE.LineBasicMaterial({
          color: corThree,
          linewidth: 2,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
      }
    });

    atualizarPosicaoCamera();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newWidth = container.clientWidth || 800;
      const newHeight = container.clientHeight || 600;
      const newAspect = newWidth / newHeight;

      camera.left = (-frustumSize * newAspect) / 2;
      camera.right = (frustumSize * newAspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [
    larguraPdf,
    alturaPdf,
    canvasPlanta2D,
    itens,
    niveis,
    apenasMarcacoes,
    mostrarGrid,
    escalaVertical,
    atualizarPosicaoCamera,
  ]);

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button === 0) {
      isDraggingRef.current = true;
    } else if (e.button === 2 || e.button === 1) {
      isPanningRef.current = true;
    }
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI / 2 + 0.2, sphericalRef.current.phi - deltaY * 0.008),
      );
      atualizarPosicaoCamera();
    } else if (isPanningRef.current && cameraRef.current) {
      const panFactor = 0.8 / (cameraRef.current.zoom || 1);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
        cameraRef.current.quaternion,
      );
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
        cameraRef.current.quaternion,
      );

      targetRef.current.addScaledVector(right, -deltaX * panFactor);
      targetRef.current.addScaledVector(up, deltaY * panFactor);
      atualizarPosicaoCamera();
    }
  }

  function onMouseUp() {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!cameraRef.current) return;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    cameraRef.current.zoom = Math.max(
      0.2,
      Math.min(8, cameraRef.current.zoom * zoomFactor),
    );
    cameraRef.current.updateProjectionMatrix();
    atualizarPosicaoCamera();
  }

  function exportarImagemPng() {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    baixarDataUrl(
      dataUrl,
      `levantamento-3d-${obraNome.toLowerCase().replace(/\s+/g, "_")}-pag${pagina}.png`,
    );
  }

  function exportarPdf3D() {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl3D = rendererRef.current.domElement.toDataURL("image/png");

    const html = `
      <div class="header">
        <div>
          <h1>Levantamento de Quantidades - Perspectiva Isométrica 3D</h1>
          <p>Obra: <strong>${obraNome}</strong> | Planta: <strong>${plantaNome}</strong> (Página ${pagina})</p>
        </div>
        <div style="text-align: right;">
          <p>Data: ${new Date().toLocaleDateString("pt-BR")}</p>
          <p>Vasconcelos Engenharia</p>
        </div>
      </div>

      <div class="grid-tabelas">
        <div class="secao">
          <h3>Resumo Geral de Elementos 3D</h3>
          <table>
            <thead>
              <tr>
                <th>Elemento</th>
                <th>Cota (m)</th>
                <th class="text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${resumo.elementos
                .map(
                  (el) => `
                <tr>
                  <td><span class="badge-cor" style="background:${el.cor}"></span>${el.nome}</td>
                  <td>${el.nivelNome ?? "-"}</td>
                  <td class="text-right">${el.quantidade} un</td>
                </tr>
              `,
                )
                .join("")}
              ${resumo.descidasSubidas
                .map(
                  (desc) => `
                <tr>
                  <td><span class="badge-cor" style="background:${desc.cor}"></span>Descida/Subida (${desc.nome})</td>
                  <td>Vertical</td>
                  <td class="text-right">${desc.alturaTotal.toFixed(2)} m</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="secao">
          <h3>Resumo de Tubulações e Cabos</h3>
          <table>
            <thead>
              <tr>
                <th>Tipo / Circuito</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${resumo.distancias
                .map(
                  (d) => `
                <tr>
                  <td><span class="badge-cor" style="background:${d.cor}"></span>${d.nome}</td>
                  <td class="text-right">${d.totalMetros.toFixed(2)} m</td>
                </tr>
              `,
                )
                .join("")}
              ${resumo.cabos
                .map(
                  (c) => `
                <tr>
                  <td>${c.circuito} (${c.tipoCabo} - ${c.funcao})</td>
                  <td class="text-right">${c.comprimentoTotal.toFixed(2)} m</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="imagem-container">
        <h3 style="margin-bottom: 8px; color: #334155;">Visualização Isométrica 3D com Marcações e Níveis</h3>
        <img src="${dataUrl3D}" alt="Visualização 3D do Levantamento" />
      </div>
    `;

    exportarParaPdfViaImpressao(
      html,
      `Levantamento-3D-${obraNome}-Pag${pagina}`,
    );
  }

  return (
    <div className="relative w-full h-[720px] rounded-2xl overflow-hidden border border-superficie-800 bg-[#090d16] flex flex-col select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-white z-20">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => definirVista("iso_ne")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                vistaAtual === "iso_ne"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              Isométrica NE
            </button>
            <button
              type="button"
              onClick={() => definirVista("iso_nw")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                vistaAtual === "iso_nw"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              Isométrica NW
            </button>
            <button
              type="button"
              onClick={() => definirVista("topo")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                vistaAtual === "topo"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              Planta Topo
            </button>
            <button
              type="button"
              onClick={() => definirVista("frente")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                vistaAtual === "frente"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              Elevação
            </button>
          </div>

          <button
            type="button"
            onClick={() => setApenasMarcacoes(!apenasMarcacoes)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              apenasMarcacoes
                ? "bg-purple-600/30 border-purple-500 text-purple-300"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Exibir apenas marcações 3D sem a planta 2D de fundo"
          >
            {apenasMarcacoes ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Apenas Marcações 3D
          </button>

          <button
            type="button"
            onClick={() => setMostrarGrid(!mostrarGrid)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              !mostrarGrid
                ? "bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700"
                : "bg-azul-600/30 border-azul-500 text-azul-300"
            }`}
            title="Ocultar ou exibir a grade / linhas de referência 3D"
          >
            Grade 3D ({mostrarGrid ? "Visível" : "Oculta"})
          </button>

          <div className="flex items-center gap-1.5 px-2 bg-slate-800/80 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Escala Z:</span>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.25"
              value={escalaVertical}
              onChange={(e) => setEscalaVertical(Number(e.target.value))}
              className="w-16 accent-azul-400 cursor-pointer"
            />
            <span className="text-slate-300 min-w-6 font-mono">
              {escalaVertical}x
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportarImagemPng}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar PNG 3D
          </button>
          <button
            type="button"
            onClick={exportarPdf3D}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Exportar PDF 3D
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full block"
        />

        <LegendaDinamica
          resumo={resumo}
          config={configLegenda}
          aoMudarConfig={aoMudarConfigLegenda}
        />

        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 pointer-events-none">
          <Rotate3d className="h-4 w-4 text-azul-400 shrink-0" />
          <span>
            <strong>Botão esquerdo:</strong> Girar órbita |{" "}
            <strong>Botão direito:</strong> Arrastar (Pan) |{" "}
            <strong>Scroll:</strong> Zoom
          </span>
        </div>
      </div>
    </div>
  );
}
