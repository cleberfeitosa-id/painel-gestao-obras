"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  Download,
  Rotate3d,
  Layers,
  Box,
} from "lucide-react";
import { Botao } from "@/components/ui";
import {
  type QuadroEletricoLayout,
  type DimensaoPadraoComponente,
  COMPONENTES_CATALOGO_PADRAO,
} from "@/lib/quadros/tipos";

interface VisualizadorQuadro3DProps {
  quadro: {
    tag: string;
    nome: string | null;
    tipo_quadro: string;
    corrente_nominal?: number | null;
    tensao_nominal?: string | null;
    grau_protecao?: string | null;
  };
  dimensoes: {
    larguraMm: number;
    alturaMm: number;
    profundidadeMm: number;
    larguraUtilMm: number;
    alturaUtilMm: number;
    margemLateralMm: number;
    margemTopoMm: number;
    margemBaseMm?: number;
    margemDireitaMm?: number;
  };
  layout: QuadroEletricoLayout;
  catalogo?: Record<string, DimensaoPadraoComponente>;
}

export function VisualizadorQuadro3D({
  quadro,
  dimensoes,
  layout,
  catalogo = COMPONENTES_CATALOGO_PADRAO,
}: VisualizadorQuadro3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mostrarGabinete, setMostrarGabinete] = useState(true);
  const [mostrarChapaFundo, setMostrarChapaFundo] = useState(true);
  const [mostrarGrid, setMostrarGrid] = useState(true);
  const [tampaTransparente, setTampaTransparente] = useState(true);
  const [vistaAtual, setVistaAtual] = useState<string>("iso_ne");

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const sphericalRef = useRef({
    radius: 1200,
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
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

  const definirVista = useCallback(
    (tipo: string) => {
      setVistaAtual(tipo);
      targetRef.current.set(0, 0, 0);

      switch (tipo) {
        case "iso_ne":
          sphericalRef.current = { radius: 1200, theta: Math.PI / 4, phi: Math.PI / 3.2 };
          break;
        case "iso_nw":
          sphericalRef.current = { radius: 1200, theta: -Math.PI / 4, phi: Math.PI / 3.2 };
          break;
        case "frente":
          sphericalRef.current = { radius: 1200, theta: 0, phi: Math.PI / 2.001 };
          break;
        case "lateral":
          sphericalRef.current = { radius: 1200, theta: Math.PI / 2, phi: Math.PI / 2.001 };
          break;
        case "topo":
          sphericalRef.current = { radius: 1200, theta: 0, phi: 0.001 };
          break;
      }
      atualizarPosicaoCamera();
    },
    [atualizarPosicaoCamera],
  );

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
    const frustumSize = Math.max(dimensoes.larguraMm, dimensoes.alturaMm) * 1.5;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      10000,
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(600, 1000, 800);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
    dirLight2.position.set(-600, -300, 400);
    scene.add(dirLight2);

    const {
      larguraMm,
      alturaMm,
      profundidadeMm,
      larguraUtilMm,
      alturaUtilMm,
      margemLateralMm,
      margemTopoMm,
    } = dimensoes;

    if (mostrarGrid) {
      const grid = new THREE.GridHelper(
        Math.max(larguraMm, alturaMm) * 2,
        20,
        0x0284c7,
        0x1e293b,
      );
      grid.position.y = -alturaMm / 2 - 20;
      scene.add(grid);
    }

    const espessuraChapa = 2;
    const profundidadeUtil = profundidadeMm - 20;

    if (mostrarGabinete) {
      const matGabinete = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.5,
        roughness: 0.4,
        side: THREE.DoubleSide,
      });

      const geoFundo = new THREE.BoxGeometry(larguraMm, alturaMm, espessuraChapa);
      const meshFundo = new THREE.Mesh(geoFundo, matGabinete);
      meshFundo.position.set(0, 0, -profundidadeMm / 2);
      scene.add(meshFundo);

      const geoParedeLat = new THREE.BoxGeometry(espessuraChapa, alturaMm, profundidadeMm);
      const latEsq = new THREE.Mesh(geoParedeLat, matGabinete);
      latEsq.position.set(-larguraMm / 2, 0, 0);
      scene.add(latEsq);

      const latDir = new THREE.Mesh(geoParedeLat, matGabinete);
      latDir.position.set(larguraMm / 2, 0, 0);
      scene.add(latDir);

      const geoParedeTopo = new THREE.BoxGeometry(larguraMm, espessuraChapa, profundidadeMm);
      const topoMesh = new THREE.Mesh(geoParedeTopo, matGabinete);
      topoMesh.position.set(0, alturaMm / 2, 0);
      scene.add(topoMesh);

      const baseMesh = new THREE.Mesh(geoParedeTopo, matGabinete);
      baseMesh.position.set(0, -alturaMm / 2, 0);
      scene.add(baseMesh);

      const larguraMoldura = 20;
      const matMoldura = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.6,
        roughness: 0.3,
      });

      const geoMolduraSup = new THREE.BoxGeometry(larguraMm, larguraMoldura, 4);
      const molduraSup = new THREE.Mesh(geoMolduraSup, matMoldura);
      molduraSup.position.set(0, alturaMm / 2 - larguraMoldura / 2, profundidadeMm / 2);
      scene.add(molduraSup);

      const molduraInf = new THREE.Mesh(geoMolduraSup, matMoldura);
      molduraInf.position.set(0, -alturaMm / 2 + larguraMoldura / 2, profundidadeMm / 2);
      scene.add(molduraInf);

      const geoMolduraLat = new THREE.BoxGeometry(larguraMoldura, alturaMm - larguraMoldura * 2, 4);
      const molduraEsq = new THREE.Mesh(geoMolduraLat, matMoldura);
      molduraEsq.position.set(-larguraMm / 2 + larguraMoldura / 2, 0, profundidadeMm / 2);
      scene.add(molduraEsq);

      const molduraDir = new THREE.Mesh(geoMolduraLat, matMoldura);
      molduraDir.position.set(larguraMm / 2 - larguraMoldura / 2, 0, profundidadeMm / 2);
      scene.add(molduraDir);

      if (tampaTransparente) {
        const matVidro = new THREE.MeshPhysicalMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.22,
          roughness: 0.05,
          metalness: 0.1,
          transmission: 0.85,
          ior: 1.5,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const geoVidro = new THREE.BoxGeometry(
          larguraMm - larguraMoldura * 2,
          alturaMm - larguraMoldura * 2,
          2,
        );
        const vidroMesh = new THREE.Mesh(geoVidro, matVidro);
        vidroMesh.position.set(0, 0, profundidadeMm / 2);
        vidroMesh.renderOrder = 100;
        scene.add(vidroMesh);

        const matPuxador = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.8,
          roughness: 0.2,
        });
        const geoPuxador = new THREE.BoxGeometry(10, 40, 8);
        const puxadorMesh = new THREE.Mesh(geoPuxador, matPuxador);
        puxadorMesh.position.set(larguraMm / 2 - 25, 0, profundidadeMm / 2 + 5);
        scene.add(puxadorMesh);
      }
    }

    const centroChapaX = -larguraMm / 2 + margemLateralMm + larguraUtilMm / 2;
    const centroChapaY = alturaMm / 2 - margemTopoMm - alturaUtilMm / 2;
    const zChapa = -profundidadeMm / 2 + 15;

    if (mostrarChapaFundo) {
      const geoChapaMontagem = new THREE.BoxGeometry(larguraUtilMm, alturaUtilMm, 3);
      const matChapa = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.6,
        roughness: 0.3,
      });
      const chapaMesh = new THREE.Mesh(geoChapaMontagem, matChapa);
      chapaMesh.position.set(centroChapaX, centroChapaY, zChapa);
      scene.add(chapaMesh);
    }

    function transformarCoords2DPara3D(x2d: number, y2d: number, w: number, h: number, zOffset = 0) {
      const x3d = -larguraMm / 2 + margemLateralMm + x2d + w / 2;
      const y3d = alturaMm / 2 - margemTopoMm - (y2d + h / 2);
      const z3d = zChapa + 1.5 + zOffset;
      return new THREE.Vector3(x3d, y3d, z3d);
    }

    const matTrilho = new THREE.MeshStandardMaterial({
      color: 0xc0c6d0,
      metalness: 0.85,
      roughness: 0.25,
    });

    layout.trilhos.forEach((t) => {
      const pos = transformarCoords2DPara3D(t.x, t.y, t.larguraMm, t.alturaMm, t.profundidadeMm / 2);
      const geoTrilho = new THREE.BoxGeometry(t.larguraMm, t.alturaMm, t.profundidadeMm);
      const meshTrilho = new THREE.Mesh(geoTrilho, matTrilho);
      meshTrilho.position.copy(pos);
      scene.add(meshTrilho);

      const isVertical = t.orientacao === "vertical" || t.alturaMm > t.larguraMm;
      const matFuro = new THREE.MeshBasicMaterial({ color: 0x475569 });

      if (isVertical) {
        const furos = Math.floor(t.alturaMm / 35);
        for (let i = 0; i < furos; i++) {
          const geoFuro = new THREE.BoxGeometry(8, 15, 0.5);
          const meshFuro = new THREE.Mesh(geoFuro, matFuro);
          meshFuro.position.set(
            pos.x,
            pos.y - t.alturaMm / 2 + 17.5 + i * 35,
            pos.z + t.profundidadeMm / 2 + 0.1,
          );
          scene.add(meshFuro);
        }
      } else {
        const furos = Math.floor(t.larguraMm / 35);
        for (let i = 0; i < furos; i++) {
          const geoFuro = new THREE.BoxGeometry(15, 8, 0.5);
          const meshFuro = new THREE.Mesh(geoFuro, matFuro);
          meshFuro.position.set(
            pos.x - t.larguraMm / 2 + 17.5 + i * 35,
            pos.y,
            pos.z + t.profundidadeMm / 2 + 0.1,
          );
          scene.add(meshFuro);
        }
      }
    });

    const matCanaleta = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.1,
      roughness: 0.7,
      transparent: true,
      opacity: 0.85,
    });

    layout.canaletas.forEach((c) => {
      const pos = transformarCoords2DPara3D(c.x, c.y, c.larguraMm, c.alturaMm, c.profundidadeMm / 2);
      const geoCan = new THREE.BoxGeometry(c.larguraMm, c.alturaMm, c.profundidadeMm);
      const meshCan = new THREE.Mesh(geoCan, matCanaleta);
      meshCan.position.copy(pos);
      scene.add(meshCan);
    });

    (layout.barramentosNeutroTerra ?? []).forEach((bar) => {
      const isHorizontal = bar.orientacao !== "vertical";
      const wMm = isHorizontal ? bar.comprimentoMm : bar.larguraMm;
      const hMm = isHorizontal ? bar.larguraMm : bar.comprimentoMm;
      const pos = transformarCoords2DPara3D(bar.x, bar.y, wMm, hMm, bar.profundidadeMm / 2 + 5);

      const matLatao = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.85,
        roughness: 0.25,
      });

      const geoBarraNT = new THREE.BoxGeometry(wMm, hMm, bar.profundidadeMm);
      const meshBarraNT = new THREE.Mesh(geoBarraNT, matLatao);
      meshBarraNT.position.copy(pos);
      scene.add(meshBarraNT);

      const matIsoladorNT = new THREE.MeshStandardMaterial({
        color: bar.tipo === "terra" ? 0x84cc16 : 0x0284c7,
        metalness: 0.1,
        roughness: 0.5,
      });

      const geoSuporte = new THREE.BoxGeometry(
        isHorizontal ? 12 : wMm + 6,
        isHorizontal ? hMm + 6 : 12,
        bar.profundidadeMm + 4,
      );

      if (isHorizontal) {
        const supEsq = new THREE.Mesh(geoSuporte, matIsoladorNT);
        supEsq.position.set(pos.x - wMm / 2 + 6, pos.y, pos.z - 2);
        scene.add(supEsq);

        const supDir = new THREE.Mesh(geoSuporte, matIsoladorNT);
        supDir.position.set(pos.x + wMm / 2 - 6, pos.y, pos.z - 2);
        scene.add(supDir);
      } else {
        const supTopo = new THREE.Mesh(geoSuporte, matIsoladorNT);
        supTopo.position.set(pos.x, pos.y + hMm / 2 - 6, pos.z - 2);
        scene.add(supTopo);

        const supBase = new THREE.Mesh(geoSuporte, matIsoladorNT);
        supBase.position.set(pos.x, pos.y - hMm / 2 + 6, pos.z - 2);
        scene.add(supBase);
      }

      const matFuroScrew = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.9,
        roughness: 0.2,
      });

      bar.furos.forEach((furo) => {
        const diam = furo.diametroMm || bar.diametroFuroPadraoMm || 5;
        const geoFuroCil = new THREE.CylinderGeometry(diam / 2, diam / 2, 2, 12);
        const meshFuroCil = new THREE.Mesh(geoFuroCil, matFuroScrew);
        meshFuroCil.rotation.x = Math.PI / 2;

        if (isHorizontal) {
          meshFuroCil.position.set(
            pos.x - wMm / 2 + furo.posicaoMm,
            pos.y,
            pos.z + bar.profundidadeMm / 2 + 0.5,
          );
        } else {
          meshFuroCil.position.set(
            pos.x,
            pos.y + hMm / 2 - furo.posicaoMm,
            pos.z + bar.profundidadeMm / 2 + 0.5,
          );
        }
        scene.add(meshFuroCil);
      });
    });

    const matIsolador = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.1,
      roughness: 0.4,
    });

    layout.barramentos.forEach((bar) => {
      const numBarras = bar.tipo === "trifasico" ? 3 : bar.tipo === "tetrapolar" ? 4 : bar.tipo === "bifasico" ? 2 : 1;
      const larguraBarra = bar.larguraBarraIndividualMm || Math.max(10, Math.floor(bar.larguraTroncoMm / (numBarras * 1.5)));
      const espacamento = bar.espacamentoEntreBarrasMm || 12;
      const larguraTotal = numBarras * larguraBarra + (numBarras - 1) * espacamento;
      const espessura = bar.espessuraBarraMm || 4;

      const posCentro = transformarCoords2DPara3D(
        bar.x,
        bar.y,
        bar.larguraTroncoMm,
        bar.alturaMm,
        30,
      );

      const fasesCores = [0xef4444, 0xeab308, 0x3b82f6, 0x10b981];

      for (let b = 0; b < numBarras; b++) {
        const offsetBarraX = -larguraTotal / 2 + b * (larguraBarra + espacamento) + larguraBarra / 2;
        const geoBarra = new THREE.BoxGeometry(larguraBarra, bar.alturaMm, espessura);
        const matBarraIndividual = new THREE.MeshStandardMaterial({
          color: 0xc2410c,
          metalness: 0.85,
          roughness: 0.2,
        });
        const meshBarra = new THREE.Mesh(geoBarra, matBarraIndividual);
        meshBarra.position.set(posCentro.x + offsetBarraX, posCentro.y, posCentro.z);
        scene.add(meshBarra);

        const iso1 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 25, 12), matIsolador);
        iso1.rotation.x = Math.PI / 2;
        iso1.position.set(posCentro.x + offsetBarraX, posCentro.y + bar.alturaMm / 3, zChapa + 14);
        scene.add(iso1);

        const iso2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 25, 12), matIsolador);
        iso2.rotation.x = Math.PI / 2;
        iso2.position.set(posCentro.x + offsetBarraX, posCentro.y - bar.alturaMm / 3, zChapa + 14);
        scene.add(iso2);
      }

      bar.derivacoes.forEach((der) => {
        const yDeriv3D = posCentro.y + bar.alturaMm / 2 - der.yOffsetMm;
        const corFaseHex =
          der.fase === "R"
            ? 0xef4444
            : der.fase === "S"
              ? 0xeab308
              : der.fase === "T"
                ? 0x3b82f6
                : 0x10b981;

        const matFase = new THREE.MeshStandardMaterial({
          color: corFaseHex,
          metalness: 0.7,
          roughness: 0.3,
        });

        const compLado = der.larguraDerivacaoMm || 35;
        const geoDeriv = new THREE.BoxGeometry(
          bar.larguraTroncoMm + compLado * 2,
          10,
          espessura,
        );
        const meshDeriv = new THREE.Mesh(geoDeriv, matFase);
        meshDeriv.position.set(posCentro.x, yDeriv3D, posCentro.z + espessura);
        scene.add(meshDeriv);
      });
    });

    layout.elementos.forEach((el) => {
      const cat = catalogo[el.tipo] || COMPONENTES_CATALOGO_PADRAO[el.tipo];
      const pos = transformarCoords2DPara3D(
        el.x,
        el.y,
        el.larguraMm,
        el.alturaMm,
        el.profundidadeMm / 2 + (el.trilhoId ? 7.5 : 0),
      );

      let corCorpo = 0xf8fafc;
      if (el.tipo.includes("caixa_moldada")) {
        corCorpo = 0x1e293b;
      } else if (el.tipo.startsWith("borne_terra")) {
        corCorpo = 0x84cc16;
      } else if (el.tipo.startsWith("borne_neutro")) {
        corCorpo = 0x38bdf8;
      } else if (el.tipo.startsWith("dps")) {
        corCorpo = 0xfee2e2;
      }

      const matCorpo = new THREE.MeshStandardMaterial({
        color: el.corPersonalizada ? new THREE.Color(el.corPersonalizada) : corCorpo,
        metalness: 0.15,
        roughness: 0.4,
      });

      const geoCorpo = new THREE.BoxGeometry(el.larguraMm, el.alturaMm, el.profundidadeMm);
      const meshCorpo = new THREE.Mesh(geoCorpo, matCorpo);
      meshCorpo.position.copy(pos);
      scene.add(meshCorpo);

      if (cat?.categoria === "disjuntor" || el.tipo.includes("disjuntor")) {
        const matAlavanca = new THREE.MeshStandardMaterial({
          color: el.tipo.includes("caixa_moldada") ? 0xef4444 : 0x0f172a,
          metalness: 0.2,
          roughness: 0.3,
        });
        const geoAlavanca = new THREE.BoxGeometry(
          Math.min(10, el.larguraMm * 0.6),
          16,
          8,
        );
        const meshAlavanca = new THREE.Mesh(geoAlavanca, matAlavanca);
        meshAlavanca.position.set(pos.x, pos.y, pos.z + el.profundidadeMm / 2 + 4);
        scene.add(meshAlavanca);
      }

      const matTerminal = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.7,
        roughness: 0.3,
      });
      const geoTerm = new THREE.CylinderGeometry(
        Math.min(3.5, el.larguraMm / 4),
        Math.min(3.5, el.larguraMm / 4),
        4,
        8,
      );

      const termTopo = new THREE.Mesh(geoTerm, matTerminal);
      termTopo.position.set(pos.x, pos.y + el.alturaMm / 2 - 4, pos.z + el.profundidadeMm / 4);
      scene.add(termTopo);

      const termBase = new THREE.Mesh(geoTerm, matTerminal);
      termBase.position.set(pos.x, pos.y - el.alturaMm / 2 + 4, pos.z + el.profundidadeMm / 4);
      scene.add(termBase);
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
    dimensoes,
    layout,
    catalogo,
    mostrarGabinete,
    mostrarChapaFundo,
    mostrarGrid,
    tampaTransparente,
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
        Math.min(Math.PI / 2 + 0.3, sphericalRef.current.phi - deltaY * 0.008),
      );
      atualizarPosicaoCamera();
    } else if (isPanningRef.current && cameraRef.current) {
      const panFactor = 1.0 / (cameraRef.current.zoom || 1);
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
      0.3,
      Math.min(8, cameraRef.current.zoom * zoomFactor),
    );
    cameraRef.current.updateProjectionMatrix();
    atualizarPosicaoCamera();
  }

  function exportarImagemPng() {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `quadro-3d-${quadro.tag.toLowerCase().replace(/\s+/g, "_")}.png`;
    link.href = dataUrl;
    link.click();
  }

  return (
    <div className="relative w-full h-full min-h-[500px] flex-1 bg-[#090d16] flex flex-col select-none overflow-hidden">
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
              onClick={() => definirVista("frente")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                vistaAtual === "frente"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              Elevação Frontal
            </button>
            <button
              type="button"
              onClick={() => definirVista("lateral")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                vistaAtual === "lateral"
                  ? "bg-azul-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              Lateral
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
              Topo
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMostrarGabinete(!mostrarGabinete)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              mostrarGabinete
                ? "bg-azul-600/30 border-azul-500 text-azul-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            Invólucro ({mostrarGabinete ? "Visível" : "Oculto"})
          </button>

          {mostrarGabinete && (
            <button
              type="button"
              onClick={() => setTampaTransparente(!tampaTransparente)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                tampaTransparente
                  ? "bg-cyan-600/30 border-cyan-500 text-cyan-300"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
              }`}
              title="Alternar entre visor transparente e tampa aberta"
            >
              <Box className="h-3.5 w-3.5" />
              Tampa: {tampaTransparente ? "Visor Transparente" : "Aberta"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMostrarChapaFundo(!mostrarChapaFundo)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              mostrarChapaFundo
                ? "bg-amber-600/30 border-amber-500 text-amber-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Chapa Útil ({mostrarChapaFundo ? "Visível" : "Oculta"})
          </button>

          <button
            type="button"
            onClick={() => setMostrarGrid(!mostrarGrid)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              mostrarGrid
                ? "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Grade 3D
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Botao
            type="button"
            variante="primario"
            tamanho="sm"
            onClick={exportarImagemPng}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar PNG 3D
          </Botao>
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

        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 pointer-events-none">
          <Rotate3d className="h-4 w-4 text-azul-400 shrink-0" />
          <span>
            <strong>Botão esquerdo:</strong> Girar órbita |{" "}
            <strong>Botão direito:</strong> Pan |{" "}
            <strong>Scroll:</strong> Zoom
          </span>
        </div>

        <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-1 shadow-lg pointer-events-none">
          <p className="font-bold text-white uppercase text-[11px] tracking-wider">
            {quadro.tipo_quadro} - {quadro.tag}
          </p>
          <p className="text-slate-400">
            Dimensões: {dimensoes.larguraMm}×{dimensoes.alturaMm}×{dimensoes.profundidadeMm}mm
          </p>
          <p className="text-slate-400">
            Área Útil: {dimensoes.larguraUtilMm}×{dimensoes.alturaUtilMm}mm
          </p>
          <p className="text-slate-400">
            Componentes: {layout.elementos.length} un | Trilhos: {layout.trilhos.length} | Barramentos: {layout.barramentos.length}
          </p>
        </div>
      </div>
    </div>
  );
}
