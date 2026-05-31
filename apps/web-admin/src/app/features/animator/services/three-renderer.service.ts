import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Observable, Subject } from 'rxjs';
import {
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_CONTROLS_CONFIG,
  DEFAULT_RENDERER_CONFIG,
  LoadedModelData,
} from '../models/animator.types';

/**
 * Servicio para renderizado 3D con Three.js
 * Encapsula toda la lógica de Three.js para el animador
 */
@Injectable()
export class ThreeRendererService {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;

  private mixer: THREE.AnimationMixer | null = null;
  private animationClips: THREE.AnimationClip[] = [];
  private originalPose = new Map<string, THREE.Matrix4>();
  private originalAction: THREE.AnimationAction | null = null;
  private currentAction: THREE.AnimationAction | null = null;

  private readonly modelLoadedSubject = new Subject<LoadedModelData>();
  private readonly animationFinishedSubject = new Subject<void>();

  /** Observable que emite cuando un modelo se carga */
  readonly modelLoaded$ = this.modelLoadedSubject.asObservable();

  /** Observable que emite cuando una animación termina */
  readonly animationFinished$ = this.animationFinishedSubject.asObservable();

  /** Clips de animación disponibles */
  get clips(): THREE.AnimationClip[] {
    return this.animationClips;
  }

  /** Mixer de animación actual */
  get currentMixer(): THREE.AnimationMixer | null {
    return this.mixer;
  }

  /**
   * Inicializa la escena Three.js
   */
  initialize(container: HTMLElement): void {
    this.dispose();

    // Escena
    this.scene = new THREE.Scene();

    // Cámara
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      DEFAULT_CAMERA_CONFIG.fov,
      aspect,
      DEFAULT_CAMERA_CONFIG.near,
      DEFAULT_CAMERA_CONFIG.far
    );
    this.camera.position.set(
      DEFAULT_CAMERA_CONFIG.position.x,
      DEFAULT_CAMERA_CONFIG.position.y,
      DEFAULT_CAMERA_CONFIG.position.z
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: DEFAULT_RENDERER_CONFIG.antialias,
    });
    this.renderer.setClearColor(DEFAULT_RENDERER_CONFIG.clearColor);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = DEFAULT_RENDERER_CONFIG.shadowMapEnabled;
    container.appendChild(this.renderer.domElement);

    // Controles
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = DEFAULT_CONTROLS_CONFIG.enableDamping;
    this.controls.dampingFactor = DEFAULT_CONTROLS_CONFIG.dampingFactor;
    this.controls.maxDistance = DEFAULT_CONTROLS_CONFIG.maxDistance;
    this.controls.minDistance = DEFAULT_CONTROLS_CONFIG.minDistance;

    // Luces
    this.setupLights();

    // Iniciar loop de animación
    this.startAnimationLoop();
  }

  /**
   * Configura las luces de la escena
   */
  private setupLights(): void {
    if (!this.scene) return;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
  }

  /**
   * Carga un modelo 3D
   */
  loadModel(url: string, modelId: string): void {
    // Strip query params (?token=...) before detecting file extension
    const urlWithoutQuery = url.split('?')[0];
    const extension = urlWithoutQuery.split('.').pop()?.toLowerCase();

    if (extension === 'gltf' || extension === 'glb') {
      this.loadGLTF(url, modelId);
    } else if (extension === 'fbx') {
      this.loadFBX(url, modelId);
    }
  }

  /**
   * Carga un modelo GLTF/GLB
   */
  private loadGLTF(url: string, modelId: string): void {
    const loader = new GLTFLoader();
    const token = localStorage.getItem('token');
    if (token && this.isApiOrigin(url)) {
      loader.setRequestHeader({ Authorization: `Bearer ${token}` });
    }

    loader.load(url, (gltf) => {
      if (!this.scene) return;

      const model = gltf.scene;
      this.scene.add(model);

      // Centrar cámara en el modelo
      this.centerCameraOnModel(model);

      // Crear mixer
      this.mixer = new THREE.AnimationMixer(model);
      this.animationClips = gltf.animations;

      // Guardar pose original
      this.originalPose.clear();
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          this.originalPose.set(child.uuid, child.matrix.clone());
        }
      });

      // Configurar animación original (pausada)
      if (this.animationClips.length > 0) {
        this.originalAction = this.mixer.clipAction(this.animationClips[0]);
        this.originalAction.play();
        this.originalAction.paused = true;
      }

      // Emitir evento de modelo cargado
      this.modelLoadedSubject.next({
        id: modelId,
        url,
        mixer: this.mixer,
        clips: this.animationClips,
        originalPose: this.originalPose,
      });
    });
  }

  /**
   * Carga un modelo FBX
   */
  private loadFBX(url: string, modelId: string): void {
    const loader = new FBXLoader();
    const token = localStorage.getItem('token');
    if (token && this.isApiOrigin(url)) {
      loader.setRequestHeader({ Authorization: `Bearer ${token}` });
    }

    loader.load(url, (fbx) => {
      if (!this.scene) return;

      fbx.scale.setScalar(0.1);
      this.scene.add(fbx);

      // Centrar cámara en el modelo
      this.centerCameraOnModel(fbx);

      this.animationClips = [];
      this.mixer = null;

      this.modelLoadedSubject.next({
        id: modelId,
        url,
        mixer: null,
        clips: [],
        originalPose: new Map(),
      });
    });
  }

  /**
   * Centra la cámara en el modelo cargado
   * Calcula el bounding box y ajusta la posición de la cámara
   */
  private centerCameraOnModel(model: THREE.Object3D): void {
    if (!this.camera || !this.controls) return;

    // Calcular bounding box del modelo
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Obtener el tamaño máximo para calcular la distancia de la cámara
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    
    // Calcular distancia ideal para que el modelo quepa en la vista
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    
    // Agregar un margen para que no quede muy pegado
    cameraDistance *= 1.5;

    // Posicionar la cámara
    const direction = new THREE.Vector3(0, 0.5, 1).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));
    
    // Apuntar la cámara al centro del modelo
    this.camera.lookAt(center);

    // Actualizar el target de los controles orbitales
    this.controls.target.copy(center);
    this.controls.update();

    // Centrar el modelo en el origen (opcional, para rotación más natural)
    model.position.sub(center);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Reproduce una animación por nombre
   */
  playAnimation(clipName: string): void {
    if (!this.mixer) return;

    const clip = this.animationClips.find((c) => c.name === clipName);
    if (!clip) return;

    // Detener acción actual
    this.stopCurrentAction();

    const action = this.mixer.clipAction(clip);
    this.currentAction = action;

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();

    // Listener para cuando termina
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === action) {
        this.currentAction = null;
        this.restoreOriginalPose();
        this.mixer?.removeEventListener('finished', onFinished);
        this.animationFinishedSubject.next();
      }
    };

    this.mixer.addEventListener('finished', onFinished);
  }

  /**
   * Reproduce una animación por índice
   */
  playAnimationByIndex(index: number): THREE.AnimationAction | null {
    if (!this.mixer || index < 0 || index >= this.animationClips.length) {
      return null;
    }

    const clip = this.animationClips[index];
    const action = this.mixer.clipAction(clip);
    this.currentAction = action;

    action.reset().play();
    return action;
  }

  /**
   * Obtiene el índice de un clip por nombre
   */
  getClipIndex(clipName: string): number {
    return this.animationClips.findIndex((c) => c.name === clipName);
  }

  /**
   * Detiene la acción actual
   */
  stopCurrentAction(): void {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  /**
   * Detiene todas las acciones
   */
  stopAllActions(): void {
    this.mixer?.stopAllAction();
    this.currentAction = null;
  }

  /**
   * Restaura la pose original del modelo
   */
  restoreOriginalPose(): void {
    if (!this.mixer) return;

    const root = this.mixer.getRoot();
    if (!(root instanceof THREE.Object3D)) return;

    this.mixer.stopAllAction();

    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const originalMatrix = this.originalPose.get(child.uuid);
        if (originalMatrix) {
          child.matrix.copy(originalMatrix);
          child.matrix.decompose(child.position, child.quaternion, child.scale);
        }
      }
    });
  }

  /**
   * Inicia el loop de animación
   */
  private startAnimationLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      this.controls?.update();

      const delta = this.clock.getDelta();
      this.mixer?.update(delta);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    animate();
  }

  /**
   * Cambia el color de fondo del canvas
   * @param color Color en formato hexadecimal (ej: 0xf5f5f5)
   */
  setBackgroundColor(color: number): void {
    if (this.renderer) {
      this.renderer.setClearColor(color);
    }
  }

  /** Solo envía JWT cuando la URL apunta al backend (/api/files), no a Supabase */
  private isApiOrigin(url: string): boolean {
    try {
      const urlObj = new URL(url, window.location.origin);
      return !urlObj.hostname.includes('supabase.co');
    } catch {
      return true;
    }
  }

  /**
   * Limpia todos los recursos
   */
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.stopAllActions();
    this.mixer = null;
    this.animationClips = [];
    this.originalPose.clear();
    this.originalAction = null;
    this.currentAction = null;

    this.controls?.dispose();
    this.renderer?.dispose();

    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
  }
}
