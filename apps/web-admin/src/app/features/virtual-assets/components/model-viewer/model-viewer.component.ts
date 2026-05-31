import { Component, ElementRef, OnInit, OnDestroy, ViewChild, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Subject, takeUntil } from 'rxjs';
import { ThemeManagerService } from '@core/services/theme-manager.service';

/** Colores de fondo del canvas 3D según el tema */
const THEME_COLORS = {
  light: 0xf5f5f5,
  dark: 0x1e1e1e,
} as const;

@Component({
  selector: 'app-model-viewer',
  templateUrl: './model-viewer.component.html',
  styleUrls: ['./model-viewer.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
  ],
})
export class ModelViewerComponent implements OnInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  private mixer: THREE.AnimationMixer | null = null;
  private clock = new THREE.Clock();
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly themeManager = inject(ThemeManagerService);

  constructor(
    private dialogRef: MatDialogRef<ModelViewerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { modelUrl: string }
  ) {}

  ngOnInit(): void {
    this.initThreeJS();
    this.subscribeToThemeChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.renderer?.dispose();
  }

  private subscribeToThemeChanges(): void {
    this.themeManager.themeChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyThemeToCanvas();
      });
  }

  private applyThemeToCanvas(): void {
    if (!this.renderer) return;
    const isDark = this.themeManager.isDarkMode();
    const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
    this.renderer.setClearColor(color);
  }

  private getThemeColor(): number {
    return this.themeManager.isDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  }

  initThreeJS() {
    const container = this.canvasContainer.nativeElement;
    const scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    this.renderer.setClearColor(this.getThemeColor());
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = false;
    this.controls.maxDistance = 20;
    this.controls.minDistance = 2;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Strip query params (?token=...) before detecting file extension
    const urlWithoutQuery = this.data.modelUrl.split('?')[0];
    const fileExtension = urlWithoutQuery.split('.').pop()?.toLowerCase();
    if (fileExtension === 'gltf' || fileExtension === 'glb') {
      const gltfLoader = new GLTFLoader();
      const token = localStorage.getItem('token');
      if (token && this.isApiOrigin(this.data.modelUrl)) {
        gltfLoader.setRequestHeader({ Authorization: `Bearer ${token}` });
      }
      gltfLoader.load(this.data.modelUrl, (gltf: any) => {
        const model = gltf.scene;
        model.castShadow = true;
        model.receiveShadow = true;
        scene.add(model);

        // Centrar cámara en el modelo
        this.centerCameraOnModel(model);

        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip: THREE.AnimationClip) => {
            const action = this.mixer!.clipAction(clip);
            action.play();
          });
        }
      }, undefined, () => {
        // Error al cargar modelo GLTF/GLB - se podría notificar al usuario
      });
    } else if (fileExtension === 'fbx') {
      const fbxLoader = new FBXLoader();
      const fbxToken = localStorage.getItem('token');
      if (fbxToken && this.isApiOrigin(this.data.modelUrl)) {
        fbxLoader.setRequestHeader({ Authorization: `Bearer ${fbxToken}` });
      }
      fbxLoader.load(this.data.modelUrl, (fbx: any) => {
        fbx.scale.setScalar(0.1);
        fbx.castShadow = true;
        fbx.receiveShadow = true;
        scene.add(fbx);

        // Centrar cámara en el modelo
        this.centerCameraOnModel(fbx);
      }, undefined, () => {
        // Error al cargar modelo FBX - se podría notificar al usuario
      });
    } else {
      // Formato de archivo no soportado
    }

    this.camera.position.set(0, 1.5, 5);

    const camera = this.camera;
    const renderer = this.renderer;
    const controls = this.controls;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      const delta = this.clock.getDelta();
      if (this.mixer) this.mixer.update(delta);

      renderer.render(scene, camera);
    };

    animate();
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

    // Centrar el modelo en el origen (para rotación más natural)
    model.position.sub(center);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  closeDialog() {
    this.dialogRef.close();
  }

  private isApiOrigin(url: string): boolean {
    try {
      const urlObj = new URL(url, window.location.origin);
      return !urlObj.hostname.includes('supabase.co');
    } catch {
      return true;
    }
  }
}
