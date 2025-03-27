<template>
    <canvas ref="canvasRef" class="canvas-container" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/stl';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import { GridMaterial } from '@babylonjs/materials/grid';
import exampleModel from '@/assets/example.stl';
import * as GUI from '@babylonjs/gui';

const props = defineProps({
    settings: Object,
    actionStack: Array,
    undoLastAction: Function,
    paintColor: String,
    fileUrl: String,
    fileExtension: String,
    selectedTool: String,
    enableSnapping: Boolean,
});

let previousKey = null;

const actionStack = props.actionStack;

const emit = defineEmits(['context-initialized', 'tool-changed', 'measurement-completed', 'enable-transform-input', 'update-transform-from-gizmo']);

const canvasRef = ref(null);

let engine, scene, camera, light, highlightMaterial, glowLayer, ground, gizmoManager;

const selectedFile = ref(null);

let previousHighlightMesh = null;
let createdFaceMeshes = [];

const MIN_CAMERA_RADIUS = 1.5;

// Measuring
let measurePoints = [];
let measureLine = null;
let advancedTexture = null;
let distanceText = null;
let previewPoint = null;

const initBabylonJS = () => {
    // Initialize engine and scene
    engine = new BABYLON.Engine(canvasRef.value, true);
    scene = new BABYLON.Scene(engine);
    scene.clearColor = BABYLON.Color3.FromHexString(props.settings.backgroundColor);

    // Initialize camera
    camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, props.settings.cameraRadius, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvasRef.value, true);
    camera.wheelPrecision = 50 / props.settings.cameraSpeed;
    camera.angularSensibilityX = 1000 / props.settings.cameraSpeed;
    camera.angularSensibilityY = 1000 / props.settings.cameraSpeed;
    camera.setPosition(new BABYLON.Vector3(props.settings.startX, props.settings.startY, props.settings.cameraRadius));

    // Initialize light
    light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(props.settings.lightDirectionX, props.settings.lightDirectionY, props.settings.lightDirectionZ), scene);
    light.intensity = props.settings.lightIntensity;
    light.diffuse = BABYLON.Color3.FromHexString(props.settings.lightColor);

    // Initialize materials
    highlightMaterial = new BABYLON.StandardMaterial("highlightMaterial", scene);
    highlightMaterial.diffuseColor = BABYLON.Color3.FromHexString("#00ffff");
    highlightMaterial.emissiveColor = BABYLON.Color3.FromHexString("#00ffff");
    highlightMaterial.specularColor = BABYLON.Color3.FromHexString("#ffffff");
    highlightMaterial.alpha = 0.7;
    highlightMaterial.wireframe = false;
    highlightMaterial.backFaceCulling = false;
    highlightMaterial.disableLighting = false;
    highlightMaterial.renderingGroupId = 1;
    highlightMaterial.renderingOrder = 1;
    highlightMaterial.zOffset = -2;

    glowLayer = new BABYLON.GlowLayer("glowLayer", scene, {
        mainTextureFixedSize: 512,
        blurKernelSize: 64
    });
    glowLayer.intensity = 0.4;

    // Initialize gizmo manager
    gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = true;
    gizmoManager.gizmos.scaleGizmo.scaleRatio = 1.25;

    if (gizmoManager.gizmos.rotationGizmo) {
        gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    }

    let initialTransform = null;

    // Track gizmo transformations
    const trackGizmoTransformations = (gizmo) => {
        gizmo.onDragStartObservable.add(() => {
            const mesh = gizmo.attachedMesh;
            if (mesh) {
                initialTransform = {
                    position: mesh.position.clone(),
                    rotation: mesh.rotation.clone(),
                    scaling: mesh.scaling.clone()
                };
            }
        });

        gizmo.onDragEndObservable.add(() => {
            const mesh = gizmo.attachedMesh;
            if (mesh && initialTransform) {
                const finalTransform = {
                    position: mesh.position.clone(),
                    rotation: mesh.rotation.clone(),
                    scaling: mesh.scaling.clone()
                };
                props.actionStack.push({
                    type: 'transform',
                    mesh,
                    initialTransform,
                    finalTransform
                });

                // Emit events to update settings
                emit('update-transform-from-gizmo', 'position', 'x', mesh.position.x);
                emit('update-transform-from-gizmo', 'position', 'y', mesh.position.y);
                emit('update-transform-from-gizmo', 'position', 'z', mesh.position.z);
                emit('update-transform-from-gizmo', 'rotation', 'x', mesh.rotation.x);
                emit('update-transform-from-gizmo', 'rotation', 'y', mesh.rotation.y);
                emit('update-transform-from-gizmo', 'rotation', 'z', mesh.rotation.z);
                emit('update-transform-from-gizmo', 'scaling', 'x', mesh.scaling.x);
                emit('update-transform-from-gizmo', 'scaling', 'y', mesh.scaling.y);
                emit('update-transform-from-gizmo', 'scaling', 'z', mesh.scaling.z);
            }
        });
    };

    trackGizmoTransformations(gizmoManager.gizmos.positionGizmo);
    trackGizmoTransformations(gizmoManager.gizmos.rotationGizmo);
    trackGizmoTransformations(gizmoManager.gizmos.scaleGizmo);

    // Create ground mesh
    ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

    // Create grid material
    const gridMaterial = new GridMaterial("gridMaterial", scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new BABYLON.Color3(1, 1, 1);
    gridMaterial.lineColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    gridMaterial.opacity = 0.3;

    // Apply grid material to ground
    ground.material = gridMaterial;
    ground.isPickable = false; // Make ground not pickable
    ground.renderingGroupId = 0;

    // Run render loop
    engine.runRenderLoop(() => {
        if (camera.radius < MIN_CAMERA_RADIUS) {
            camera.radius = MIN_CAMERA_RADIUS;
        }
        props.settings.cameraRadius = parseFloat(camera.radius.toFixed(2));
        scene.render();
    });

    const graphicsContext = {
        engine,
        scene,
        camera,
        light,
        gizmoManager,
        ground,
        selectedFile,
        highlightMaterial,
        glowLayer,
    }
    emit('context-initialized', graphicsContext);

    window.addEventListener('resize', handleResize);
    scene.onPointerMove = handlePointerMove;
    scene.onPointerDown = handlePointerDown;
    scene.onPointerUp = handlePointerUp;
};

const handleResize = () => {
    engine.resize();
};

onMounted(() => {
    initBabylonJS();
    loadModel(exampleModel, 'stl'); // Load the example STL file on initial load
    window.addEventListener('keydown', handleKeyDown);
    watch(() => props.fileUrl, (newUrl) => {
        if (newUrl) {
            loadModel(newUrl, props.fileExtension);
        }
    });
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleKeyDown);
    engine.stopRenderLoop();
    engine.dispose();
});

const clearPaintedFaces = () => {
    createdFaceMeshes.forEach(mesh => mesh.dispose());
    createdFaceMeshes = [];
};

const loadModel = (url, extension) => {
    // Clear all painted faces before loading a new model
    clearPaintedFaces();

    // Clear the scene before loading a new model, except for the ground
    scene.meshes.filter(mesh => mesh !== ground).forEach(mesh => mesh.dispose());

    BABYLON.SceneLoader.Append("", url, scene, () => {
        processMeshes(scene, extension);
        console.log(`${extension.toUpperCase()} model loaded`);
    }, null, null, `.${extension}`);
};

const processMeshes = (scene, extension) => {
    scene.meshes.forEach(mesh => {
        if (mesh !== ground) {
            mesh.renderingGroupId = 1;
            mesh.renderingOrder = 0;
            mesh.hasVertexAlpha = false;

            // Enable vertex colors for loaded meshes
            if (!mesh.material) {
                mesh.material = new BABYLON.StandardMaterial("vertexColorMaterial", scene);
            }
            mesh.material.vertexColorsEnabled = true;
            mesh.material.backFaceCulling = true;

            // Unweld vertices for OBJ files
            if (extension === 'obj') {
                const vertexData = BABYLON.VertexData.ExtractFromMesh(mesh);
                const positions = vertexData.positions;
                const indices = vertexData.indices;
                const normals = vertexData.normals;
                const newPositions = [];
                const newIndices = [];
                const newNormals = [];
                const newColors = [];

                for (let i = 0; i < indices.length; i += 3) {
                    const index1 = indices[i];
                    const index2 = indices[i + 1];
                    const index3 = indices[i + 2];

                    const pos1 = [positions[index1 * 3], positions[index1 * 3 + 1], positions[index1 * 3 + 2]];
                    const pos2 = [positions[index2 * 3], positions[index2 * 3 + 1], positions[index2 * 3 + 2]];
                    const pos3 = [positions[index3 * 3], positions[index3 * 3 + 1], positions[index3 * 3 + 2]];

                    const norm1 = [normals[index1 * 3], normals[index1 * 3 + 1], normals[index1 * 3 + 2]];
                    const norm2 = [normals[index2 * 3], normals[index2 * 3 + 1], normals[index2 * 3 + 2]];
                    const norm3 = [normals[index3 * 3], normals[index3 * 3 + 1], normals[index3 * 3 + 2]];

                    newPositions.push(...pos1, ...pos2, ...pos3);
                    newNormals.push(...norm1, ...norm2, ...norm3);
                    newIndices.push(i, i + 1, i + 2);

                    // Initialize colors to white
                    newColors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
                }

                vertexData.positions = newPositions;
                vertexData.indices = newIndices;
                vertexData.normals = newNormals;
                vertexData.colors = newColors;
                vertexData.applyToMesh(mesh);
            }

            mesh.actionManager = new BABYLON.ActionManager(scene);
            mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                if (props.selectedTool === 'gizmo') {
                    gizmoManager.attachToMesh(mesh);
                    emit('enable-transform-input', true);
                }
            }));
        }
    });
};

const clearMeasureElements = () => {
    scene.meshes.filter(mesh => mesh.name === "point").forEach(mesh => mesh.dispose());
    scene.meshes.filter(mesh => mesh.name === "line").forEach(mesh => mesh.dispose());
    if (advancedTexture) {
        advancedTexture.dispose();
        advancedTexture = null;
    }
    if (measureLine) {
        measureLine.dispose();
        measureLine = null;
    }
    measurePoints = [];
    if (previewPoint) {
        previewPoint.dispose();
        previewPoint = null;
    }
};

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const dragThreshold = 20;

const createHighlightMesh = (pickedMesh, pickedFaceId) => {
    const indices = pickedMesh.getIndices();
    const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    
    // Check if vertexData is valid
    if (!vertexData) {
        return null;
    }
    
    const faceIndices = [
        indices[pickedFaceId * 3],
        indices[pickedFaceId * 3 + 1],
        indices[pickedFaceId * 3 + 2]
    ];
    
    // Transform the vertex positions using the world matrix of the picked mesh
    const worldMatrix = pickedMesh.getWorldMatrix();
    const transformedPositions = [];
    for (const index of faceIndices) {
        const position = BABYLON.Vector3.FromArray(vertexData, index * 3);
        const transformedPosition = BABYLON.Vector3.TransformCoordinates(position, worldMatrix);
        transformedPositions.push(transformedPosition.x, transformedPosition.y, transformedPosition.z);
    }
    
    const highlightMesh = new BABYLON.Mesh("highlightMesh", scene);
    highlightMesh.isHighlightMesh = true;
    highlightMesh.pickedMesh = pickedMesh;
    highlightMesh.pickedFaceId = pickedFaceId;
    
    const highlightVertexData = new BABYLON.VertexData();
    highlightVertexData.positions = transformedPositions;
    highlightVertexData.indices = [0, 1, 2];
    highlightVertexData.applyToMesh(highlightMesh);
    highlightMesh.material = highlightMaterial;
    highlightMesh.renderingGroupId = 1;
    highlightMesh.renderingOrder = 1;
    
    // Create a slight offset to avoid z-fighting
    const normal = BABYLON.Vector3.Cross(
        new BABYLON.Vector3(
            transformedPositions[3] - transformedPositions[0],
            transformedPositions[4] - transformedPositions[1],
            transformedPositions[5] - transformedPositions[2]
        ),
        new BABYLON.Vector3(
            transformedPositions[6] - transformedPositions[0],
            transformedPositions[7] - transformedPositions[1],
            transformedPositions[8] - transformedPositions[2]
        )
    ).normalize().scale(0.001);
    
    highlightMesh.position = new BABYLON.Vector3(normal.x, normal.y, normal.z);
    
    // Add pulsating animation
    const pulseAnimation = new BABYLON.Animation(
        "pulseAnimation",
        "material.alpha",
        15,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );
    
    const keys = [];
    keys.push({ frame: 0, value: 0.3 });
    keys.push({ frame: 15, value: 0.7 });
    keys.push({ frame: 30, value: 0.3 });
    
    pulseAnimation.setKeys(keys);
    
    highlightMesh.animations = [pulseAnimation];
    scene.beginAnimation(highlightMesh, 0, 30, true);
    
    glowLayer.addIncludedOnlyMesh(highlightMesh);
    
    return highlightMesh;
};

const handlePointerMove = (event) => {
    if (event.buttons === 1) {
        const deltaX = Math.abs(event.clientX - dragStartX);
        const deltaY = Math.abs(event.clientY - dragStartY);
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
            isDragging = true;
        }

        // Allow painting with brush tool when dragging
        if (props.selectedTool === 'brush' && isDragging) {
            const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
            if (pickResult.hit) {
                paintSingleFace(pickResult.pickedMesh, pickResult.faceId);
            }
        }
    }

    if (props.selectedTool !== 'brush' && props.selectedTool !== 'fill' && props.selectedTool !== 'measure') {
        return;
    }

    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
    if (pickResult.hit) {
        const pickedMesh = pickResult.pickedMesh;
        const pickedFaceId = pickResult.faceId;

        if (props.selectedTool === 'brush' || props.selectedTool === 'fill') {
            // Check if the same face is already highlighted
            if (previousHighlightMesh && previousHighlightMesh.pickedMesh === pickedMesh && previousHighlightMesh.pickedFaceId === pickedFaceId) {
                return;
            }

            if (previousHighlightMesh) {
                glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
                scene.stopAnimation(previousHighlightMesh);
                previousHighlightMesh.dispose();
            }

            previousHighlightMesh = createHighlightMesh(pickedMesh, pickedFaceId);
        } else if (props.selectedTool === 'measure' && pickedMesh !== previewPoint) {
            if (previewPoint) {
                previewPoint.dispose();
                previewPoint = null;
            }

            let pickedPoint = pickResult.pickedPoint.clone();

            if (props.enableSnapping) {
                pickedPoint = getSnappedPoint(pickedMesh, pickedPoint);
            }

            previewPoint = BABYLON.MeshBuilder.CreateSphere("previewPoint", { diameter: 0.1 }, scene);
            previewPoint.position = pickedPoint;
            previewPoint.material = new BABYLON.StandardMaterial("previewPointMaterial", scene);
            previewPoint.material.diffuseColor = BABYLON.Color3.Green();
            previewPoint.renderingGroupId = 1;
            previewPoint.renderingOrder = 0;
        }
    } else {
        // Remove highlight if no mesh is picked
        if (previousHighlightMesh) {
            glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
            scene.stopAnimation(previousHighlightMesh);
            previousHighlightMesh.dispose();
            previousHighlightMesh = null;
        }
        if (previewPoint) {
            previewPoint.dispose();
            previewPoint = null;
        }
    }
};

const handlePointerDown = (event) => {
    if (event.buttons === 1) {
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        
        // Check if we're using a paint tool and clicking on a mesh
        if (props.selectedTool === 'brush' || props.selectedTool === 'fill') {
            const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
            if (pickResult.hit) {
                // Disable camera movement when drawing on mesh
                camera.detachControl(canvasRef.value);
            }
        }
        
        return;
    }
    isDragging = false;
};

const handlePointerUp = (event) => {
    // Re-enable camera controls on mouse up
    camera.attachControl(canvasRef.value, true);

    if (isDragging) {
        const deltaX = Math.abs(event.clientX - dragStartX);
        const deltaY = Math.abs(event.clientY - dragStartY);
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
            isDragging = false;
            return;
        }
    }

    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
    if (pickResult.hit) {
        const pickedMesh = pickResult.pickedMesh;
        const pickedFaceId = pickResult.faceId;

        let pickedPoint = pickResult.pickedPoint.clone();

        if (props.enableSnapping) {
            pickedPoint = getSnappedPoint(pickedMesh, pickedPoint);
        }

        switch (props.selectedTool) {
            case 'brush':
                if (event.button === 0) { // Left mouse button
                    if (!isDragging) {
                        paintSingleFace(pickedMesh, pickedFaceId);
                    }
                } else if (event.button === 2) { // Right mouse button - erase
                    eraseSingleFace(pickedMesh, pickedFaceId);
                }
                break;
            case 'fill':
                if (event.button === 0) { // Left mouse button
                    const brushSize = 3;
                    paintFaces(pickedMesh, pickedFaceId, brushSize);
                } else if (event.button === 2) { // Right mouse button - erase
                    const brushSize = 3;
                    eraseFaces(pickedMesh, pickedFaceId, brushSize);
                }
                break;
            case 'measure':
                if (event.button != 0)
                    return;

                measurePoints.push(pickedPoint);
                if (measurePoints.length > 3) {
                    measurePoints = measurePoints.slice(1);
                }

                // Draw measure points
                if (measurePoints.length === 1) {
                    const point = BABYLON.MeshBuilder.CreateSphere("point", { diameter: 0.1 }, scene);
                    point.position = measurePoints[0].add(new BABYLON.Vector3(0, 0, 0));
                    point.material = new BABYLON.StandardMaterial("pointMaterial", scene);
                    point.material.diffuseColor = BABYLON.Color3.Red();
                    point.renderingGroupId = 1;
                    point.renderingOrder = 0;

                } else if (measurePoints.length === 2) {
                    const point = BABYLON.MeshBuilder.CreateSphere("point", { diameter: 0.1 }, scene);
                    point.position = measurePoints[1].add(new BABYLON.Vector3(0, 0, 0));
                    point.material = new BABYLON.StandardMaterial("pointMaterial", scene);
                    point.material.diffuseColor = BABYLON.Color3.Red();
                    point.renderingGroupId = 1;
                    point.renderingOrder = 0;

                    // Ensure both points are valid before calculating distance
                    if (measurePoints[0] && measurePoints[1]) {
                        const distance = BABYLON.Vector3.Distance(measurePoints[0], measurePoints[1]);
                        measureLine = BABYLON.MeshBuilder.CreateLines("line", { points: measurePoints }, scene);
                        measureLine.color = BABYLON.Color3.Blue();
                        measureLine.renderingGroupId = 1;
                        measureLine.renderingOrder = 0;

                        // Optionally, add text to display the distance
                        distanceText = new GUI.TextBlock();
                        distanceText.text = `${distance.toFixed(2)} m`;
                        distanceText.color = "white";
                        distanceText.fontSize = 24;

                        advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
                        advancedTexture.addControl(distanceText);
                        distanceText.linkWithMesh(measureLine);
                        distanceText.linkOffsetY = -30;

                        emit('measurement-completed', distance);
                    } else {
                        console.error('Invalid measure points:', measurePoints);
                    }
                } else if (measurePoints.length === 3) {
                    clearMeasureElements();
                }
                break;
        }
    } else {
        if (props.selectedTool === 'gizmo') {
            gizmoManager.attachToMesh(null);
            emit('enable-transform-input', false);
        }
    }
};

const handleKeyDown = (event) => {
    if (event.key !== previousKey) {
        if (measurePoints.length > 0)
            clearMeasureElements();

        if (previousHighlightMesh) {
            glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
            scene.stopAnimation(previousHighlightMesh);
            previousHighlightMesh.dispose();
        }

        if (event.key === '1' || event.key === 'q') {
            emit('tool-changed', 'gizmo');
        } else if (event.key === '2' || event.key === 'w') {
            emit('tool-changed', 'brush');
        } else if (event.key === '3' || event.key === 'r') {
            emit('tool-changed', 'fill');
        } else if (event.key === '4' || event.key === 'e') {
            emit('tool-changed', 'measure');
        } else if (event.ctrlKey && event.key === 'z') {
            props.undoLastAction();
        }
    }
    previousKey = event.key;
};

const getSnappedPoint = (mesh, point) => {
    const vertexData = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const worldMatrix = mesh.getWorldMatrix();
    let closestVertex = null;
    let minDistance = Infinity;

    for (let i = 0; i < vertexData.length; i += 3) {
        const vertex = BABYLON.Vector3.FromArray(vertexData, i);
        const transformedVertex = BABYLON.Vector3.TransformCoordinates(vertex, worldMatrix);
        const distance = BABYLON.Vector3.Distance(transformedVertex, point);

        if (distance < minDistance) {
            minDistance = distance;
            closestVertex = transformedVertex;
        }
    }

    return closestVertex || point;
};

// Paint a single face (used by brush tool)
const paintSingleFace = (mesh, faceId) => {
    const indices = mesh.getIndices();
    const vertexData = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    let colorsData = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

    // Initialize color data if it doesn't exist
    if (!colorsData) {
        colorsData = new Float32Array(vertexData.length / 3 * 4);
        for (let i = 0; i < vertexData.length / 3; i++) {
            colorsData[i * 4] = 1.0;     // R
            colorsData[i * 4 + 1] = 1.0; // G
            colorsData[i * 4 + 2] = 1.0; // B
            colorsData[i * 4 + 3] = 1.0; // A
        }
    }

    // Get the center face vertices
    const faceIndices = [
        indices[faceId * 3],
        indices[faceId * 3 + 1],
        indices[faceId * 3 + 2]
    ];

    // Get the position of the clicked point (center of the face)
    const centerX = (vertexData[faceIndices[0] * 3] + vertexData[faceIndices[1] * 3] + vertexData[faceIndices[2] * 3]) / 3;
    const centerY = (vertexData[faceIndices[0] * 3 + 1] + vertexData[faceIndices[1] * 3 + 1] + vertexData[faceIndices[2] * 3 + 1]) / 3;
    const centerZ = (vertexData[faceIndices[0] * 3 + 2] + vertexData[faceIndices[1] * 3 + 2] + vertexData[faceIndices[2] * 3 + 2]) / 3;

    // Calculate brush radius based on brush size - much smaller than Fill tool
    const brushRadius = 0.03 * 3;

    // Find all vertices within the brush radius
    const verticesToPaint = [];
    const originalColors = [];

    // For each vertex, check if it's within brush radius
    for (let i = 0; i < vertexData.length / 3; i++) {
        const vx = vertexData[i * 3];
        const vy = vertexData[i * 3 + 1];
        const vz = vertexData[i * 3 + 2];
        
        // Calculate distance from center
        const dist = Math.sqrt(
            Math.pow(vx - centerX, 2) + 
            Math.pow(vy - centerY, 2) + 
            Math.pow(vz - centerZ, 2)
        );
        
        // Paint with a smooth falloff
        if (dist <= brushRadius) {
            // Store original color
            originalColors.push([
                colorsData[i * 4],
                colorsData[i * 4 + 1],
                colorsData[i * 4 + 2],
                colorsData[i * 4 + 3]
            ]);
            verticesToPaint.push(i);
        }
    }

    // If no vertices to paint, at least paint the center face
    if (verticesToPaint.length === 0) {
        faceIndices.forEach(index => {
            originalColors.push([
                colorsData[index * 4],
                colorsData[index * 4 + 1],
                colorsData[index * 4 + 2],
                colorsData[index * 4 + 3]
            ]);
            verticesToPaint.push(index);
        });
    }

    const paintColorArray = BABYLON.Color3.FromHexString(props.paintColor).asArray().concat([1.0]);

    // Paint all vertices in the radius
    verticesToPaint.forEach((index) => {
        colorsData[index * 4] = paintColorArray[0];
        colorsData[index * 4 + 1] = paintColorArray[1];
        colorsData[index * 4 + 2] = paintColorArray[2];
        colorsData[index * 4 + 3] = paintColorArray[3];
    });

    mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);

    // Push the action to the stack
    actionStack.push({ 
        type: 'paint', 
        mesh, 
        faceIndices: verticesToPaint, 
        originalColors 
    });
};

// Erase a single face with brush effect
const eraseSingleFace = (mesh, faceId) => {
    const indices = mesh.getIndices();
    const vertexData = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    let colorsData = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

    if (!colorsData) {
        return;
    }

    // Get the center face vertices
    const faceIndices = [
        indices[faceId * 3],
        indices[faceId * 3 + 1],
        indices[faceId * 3 + 2]
    ];

    // Get the position of the clicked point (center of the face)
    const centerX = (vertexData[faceIndices[0] * 3] + vertexData[faceIndices[1] * 3] + vertexData[faceIndices[2] * 3]) / 3;
    const centerY = (vertexData[faceIndices[0] * 3 + 1] + vertexData[faceIndices[1] * 3 + 1] + vertexData[faceIndices[2] * 3 + 1]) / 3;
    const centerZ = (vertexData[faceIndices[0] * 3 + 2] + vertexData[faceIndices[1] * 3 + 2] + vertexData[faceIndices[2] * 3 + 2]) / 3;

    // Calculate brush radius based on brush size - much smaller than Fill tool
    const brushRadius = 0.03 * 3;

    // Find all vertices within the brush radius
    const verticesToErase = [];
    const originalColors = [];

    // For each vertex, check if it's within brush radius
    for (let i = 0; i < vertexData.length / 3; i++) {
        const vx = vertexData[i * 3];
        const vy = vertexData[i * 3 + 1];
        const vz = vertexData[i * 3 + 2];
        
        // Calculate distance from center
        const dist = Math.sqrt(
            Math.pow(vx - centerX, 2) + 
            Math.pow(vy - centerY, 2) + 
            Math.pow(vz - centerZ, 2)
        );
        
        // Erase with a sharp boundary
        if (dist <= brushRadius) {
            // Store original color
            originalColors.push([
                colorsData[i * 4],
                colorsData[i * 4 + 1],
                colorsData[i * 4 + 2],
                colorsData[i * 4 + 3]
            ]);
            verticesToErase.push(i);
        }
    }

    // If no vertices to erase, at least erase the center face
    if (verticesToErase.length === 0) {
        faceIndices.forEach(index => {
            originalColors.push([
                colorsData[index * 4],
                colorsData[index * 4 + 1],
                colorsData[index * 4 + 2],
                colorsData[index * 4 + 3]
            ]);
            verticesToErase.push(index);
        });
    }

    // Reset to white
    verticesToErase.forEach(index => {
        colorsData[index * 4] = 1.0;
        colorsData[index * 4 + 1] = 1.0;
        colorsData[index * 4 + 2] = 1.0;
        colorsData[index * 4 + 3] = 1.0;
    });

    mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);
    actionStack.push({ 
        type: 'paint', 
        mesh, 
        faceIndices: verticesToErase, 
        originalColors 
    });
};

// Paint multiple faces based on brush size (used by fill tool)
const paintFaces = (mesh, centerFaceId, brushSize) => {
    const facesToPaint = getBrushFaces(mesh, centerFaceId, brushSize);
    
    const indices = mesh.getIndices();
    const vertexData = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    let colorsData = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

    // Initialize color data if it doesn't exist
    if (!colorsData) {
        colorsData = new Float32Array(vertexData.length / 3 * 4);
        for (let i = 0; i < vertexData.length / 3; i++) {
            colorsData[i * 4] = 1.0;     // R
            colorsData[i * 4 + 1] = 1.0; // G
            colorsData[i * 4 + 2] = 1.0; // B
            colorsData[i * 4 + 3] = 1.0; // A
        }
    }

    // Get all face indices
    const allFaceIndices = [];
    const originalColors = [];
    
    facesToPaint.forEach(face => {
        const faceIndices = [
            indices[face * 3],
            indices[face * 3 + 1],
            indices[face * 3 + 2]
        ];
        
        faceIndices.forEach(index => {
            allFaceIndices.push(index);
            originalColors.push([
                colorsData[index * 4],
                colorsData[index * 4 + 1],
                colorsData[index * 4 + 2],
                colorsData[index * 4 + 3]
            ]);
        });
    });
    
    const paintColorArray = BABYLON.Color3.FromHexString(props.paintColor).asArray().concat([1.0]);

    // Paint the selected faces
    allFaceIndices.forEach((index) => {
        colorsData[index * 4] = paintColorArray[0];
        colorsData[index * 4 + 1] = paintColorArray[1];
        colorsData[index * 4 + 2] = paintColorArray[2];
        colorsData[index * 4 + 3] = paintColorArray[3];
    });

    mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);

    // Push the action to the stack
    actionStack.push({ type: 'paint', mesh, faceIndices: allFaceIndices, originalColors });
};

// Erase multiple faces based on brush size (used by fill tool)
const eraseFaces = (mesh, centerFaceId, brushSize) => {
    const facesToErase = getBrushFaces(mesh, centerFaceId, brushSize);
    
    const indices = mesh.getIndices();
    let colorsData = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

    if (!colorsData) {
        return;
    }

    // Get all face indices
    const allFaceIndices = [];
    const originalColors = [];
    
    facesToErase.forEach(face => {
        const faceIndices = [
            indices[face * 3],
            indices[face * 3 + 1],
            indices[face * 3 + 2]
        ];
        
        faceIndices.forEach(index => {
            allFaceIndices.push(index);
            originalColors.push([
                colorsData[index * 4],
                colorsData[index * 4 + 1],
                colorsData[index * 4 + 2],
                colorsData[index * 4 + 3]
            ]);
        });
    });

    // Reset to white
    allFaceIndices.forEach(index => {
        colorsData[index * 4] = 1.0;
        colorsData[index * 4 + 1] = 1.0;
        colorsData[index * 4 + 2] = 1.0;
        colorsData[index * 4 + 3] = 1.0;
    });

    mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);
    actionStack.push({ type: 'paint', mesh, faceIndices: allFaceIndices, originalColors });
};

// Get faces to paint/erase within the brush size
const getBrushFaces = (mesh, centerFaceId, brushSize) => {
    // Get the indices and vertex positions
    const indices = mesh.getIndices();
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    
    // Get the center face vertices
    const faceCenterIndices = [
        indices[centerFaceId * 3],
        indices[centerFaceId * 3 + 1],
        indices[centerFaceId * 3 + 2]
    ];
    
    // Calculate center of the face
    const centerX = (positions[faceCenterIndices[0] * 3] + positions[faceCenterIndices[1] * 3] + positions[faceCenterIndices[2] * 3]) / 3;
    const centerY = (positions[faceCenterIndices[0] * 3 + 1] + positions[faceCenterIndices[1] * 3 + 1] + positions[faceCenterIndices[2] * 3 + 1]) / 3;
    const centerZ = (positions[faceCenterIndices[0] * 3 + 2] + positions[faceCenterIndices[1] * 3 + 2] + positions[faceCenterIndices[2] * 3 + 2]) / 3;
    
    // Calculate brush radius - this is for the fill tool which uses larger radius
    const brushRadius = 0.03 * 3;
    
    // For each triangle face, calculate its center and check if it's within the brush radius
    const facesToPaint = [];
    const numFaces = indices.length / 3;
    
    for (let i = 0; i < numFaces; i++) {
        const faceIndices = [
            indices[i * 3],
            indices[i * 3 + 1],
            indices[i * 3 + 2]
        ];
        
        // Calculate center of this face
        const faceX = (positions[faceIndices[0] * 3] + positions[faceIndices[1] * 3] + positions[faceIndices[2] * 3]) / 3;
        const faceY = (positions[faceIndices[0] * 3 + 1] + positions[faceIndices[1] * 3 + 1] + positions[faceIndices[2] * 3 + 1]) / 3;
        const faceZ = (positions[faceIndices[0] * 3 + 2] + positions[faceIndices[1] * 3 + 2] + positions[faceIndices[2] * 3 + 2]) / 3;
        
        // Calculate distance from center face to this face
        const distance = Math.sqrt(
            Math.pow(faceX - centerX, 2) +
            Math.pow(faceY - centerY, 2) +
            Math.pow(faceZ - centerZ, 2)
        );
        
        // Check if face is within brush radius
        if (distance <= brushRadius) {
            facesToPaint.push(i);
        }
    }
    
    return facesToPaint;
};

const handleTouchStart = (event) => {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        isDragging = false;
        
        // Check if we're using a paint tool and touching a mesh
        if (props.selectedTool === 'brush' || props.selectedTool === 'fill') {
            const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
            if (pickResult.hit) {
                // Disable camera movement when drawing on mesh
                camera.detachControl(canvasRef.value);
            }
        }
    }
};

const handleTouchMove = (event) => {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - dragStartX);
        const deltaY = Math.abs(touch.clientY - dragStartY);
        
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
            isDragging = true;
        }
        
        // Handle brush painting on touch drag
        if (props.selectedTool === 'brush' && isDragging) {
            const pickResult = scene.pick(touch.clientX, touch.clientY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
            if (pickResult.hit) {
                paintSingleFace(pickResult.pickedMesh, pickResult.faceId);
            }
        }
    }
};

const handleTouchEnd = (event) => {
    // Re-enable camera controls
    camera.attachControl(canvasRef.value, true);
    
    if (!isDragging) {
        // Handle as a tap/click
        const touch = event.changedTouches[0];
        const pickResult = scene.pick(touch.clientX, touch.clientY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
        if (pickResult.hit) {
            const pickedMesh = pickResult.pickedMesh;
            const pickedFaceId = pickResult.faceId;
            
            let pickedPoint = pickResult.pickedPoint.clone();
            
            if (props.enableSnapping) {
                pickedPoint = getSnappedPoint(pickedMesh, pickedPoint);
            }
            
            switch (props.selectedTool) {
                case 'brush':
                    paintSingleFace(pickedMesh, pickedFaceId);
                    break;
                case 'fill':
                    const brushSize = 3; // Fixed brush size instead of props.settings.brushSize
                    paintFaces(pickedMesh, pickedFaceId, brushSize);
                    break;
                case 'measure':
                    // Handle measure tool
                    measurePoints.push(pickedPoint);
                    if (measurePoints.length > 3) {
                        measurePoints = measurePoints.slice(1);
                    }
                    
                    // Draw measure points
                    if (measurePoints.length === 1) {
                        const point = BABYLON.MeshBuilder.CreateSphere("point", { diameter: 0.1 }, scene);
                        point.position = measurePoints[0].add(new BABYLON.Vector3(0, 0, 0));
                        point.material = new BABYLON.StandardMaterial("pointMaterial", scene);
                        point.material.diffuseColor = BABYLON.Color3.Red();
                        point.renderingGroupId = 1;
                        point.renderingOrder = 0;
                    } else if (measurePoints.length === 2) {
                        const point = BABYLON.MeshBuilder.CreateSphere("point", { diameter: 0.1 }, scene);
                        point.position = measurePoints[1].add(new BABYLON.Vector3(0, 0, 0));
                        point.material = new BABYLON.StandardMaterial("pointMaterial", scene);
                        point.material.diffuseColor = BABYLON.Color3.Red();
                        point.renderingGroupId = 1;
                        point.renderingOrder = 0;
                        
                        // Ensure both points are valid before calculating distance
                        if (measurePoints[0] && measurePoints[1]) {
                            const distance = BABYLON.Vector3.Distance(measurePoints[0], measurePoints[1]);
                            measureLine = BABYLON.MeshBuilder.CreateLines("line", { points: measurePoints }, scene);
                            measureLine.color = BABYLON.Color3.Blue();
                            measureLine.renderingGroupId = 1;
                            measureLine.renderingOrder = 0;
                            
                            // Optionally, add text to display the distance
                            distanceText = new GUI.TextBlock();
                            distanceText.text = `${distance.toFixed(2)} m`;
                            distanceText.color = "white";
                            distanceText.fontSize = 24;
                            
                            advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
                            advancedTexture.addControl(distanceText);
                            distanceText.linkWithMesh(measureLine);
                            distanceText.linkOffsetY = -30;
                            
                            emit('measurement-completed', distance);
                        }
                    } else if (measurePoints.length === 3) {
                        clearMeasureElements();
                    }
                    break;
                case 'gizmo':
                    gizmoManager.attachToMesh(pickedMesh);
                    emit('enable-transform-input', true);
                    break;
            }
        } else if (props.selectedTool === 'gizmo') {
            gizmoManager.attachToMesh(null);
            emit('enable-transform-input', false);
        }
    }
    
    isDragging = false;
};
</script>

<style scoped>
.canvas-container {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    outline: none;
    touch-action: none;
}
</style>