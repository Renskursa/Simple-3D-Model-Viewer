<template>
    <canvas ref="canvasRef" class="canvas-container"></canvas>
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
    selectedTool: String
});

let previousKey = null;

const actionStack = props.actionStack;

const emit = defineEmits(['context-initialized', 'tool-changed', 'measurement-completed']);

const canvasRef = ref(null);

let engine, scene, camera, light, highlightMaterial, glowLayer, ground, gizmoManager;

const selectedFile = ref(null);

let previousHighlightMesh = null;
let createdFaceMeshes = [];

const MIN_CAMERA_RADIUS = 1.5;

let measurePoints = [];
let measureLine = null;
let advancedTexture = null;
let distanceText = null;

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
    highlightMaterial.diffuseColor = BABYLON.Color3.Magenta();
    highlightMaterial.emissiveColor = BABYLON.Color3.Magenta();
    highlightMaterial.renderingGroupId = 1;
    highlightMaterial.renderingOrder = 1;

    glowLayer = new BABYLON.GlowLayer("glowLayer", scene);
    glowLayer.intensity = 0.4;

    // Initialize gizmo manager
    gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.gizmos.rotationGizmo.scaleRatio = 0.75;
    gizmoManager.scaleGizmoEnabled = true;
    gizmoManager.gizmos.scaleGizmo.scaleRatio = 1.25;

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
    console.log('Cleared all measure points, lines, and text');
};

const handlePointerMove = () => {
    if (props.selectedTool !== 'paint') {
        return;
    }

    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
    if (pickResult.hit) {
        const pickedMesh = pickResult.pickedMesh;
        const pickedFaceId = pickResult.faceId;

        // Check if the same face is already highlighted
        if (previousHighlightMesh && previousHighlightMesh.pickedMesh === pickedMesh && previousHighlightMesh.pickedFaceId === pickedFaceId) {
            return;
        }

        if (previousHighlightMesh) {
            glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
            previousHighlightMesh.dispose();
        }

        const indices = pickedMesh.getIndices();
        const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

        // Check if vertexData is valid
        if (!vertexData) {
            return;
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

        glowLayer.addIncludedOnlyMesh(highlightMesh);
        previousHighlightMesh = highlightMesh;
    } else {
        // Remove highlight if no mesh is picked
        if (previousHighlightMesh) {
            glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
            previousHighlightMesh.dispose();
            previousHighlightMesh = null;
        }
    }
};

const handlePointerDown = (event) => {
    if (event.button === 1)
        return;
    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => !mesh.isHighlightMesh && mesh !== ground);
    if (pickResult.hit) {
        const pickedMesh = pickResult.pickedMesh;
        const pickedFaceId = pickResult.faceId;
        console.log('Picked face ID:', pickedFaceId);


        switch (props.selectedTool) {
            case 'paint':
                const indices = pickedMesh.getIndices();
                const vertexData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                let colorsData = pickedMesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);

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

                const faceIndices = [
                    indices[pickedFaceId * 3],
                    indices[pickedFaceId * 3 + 1],
                    indices[pickedFaceId * 3 + 2]
                ];

                const paintColorArray = BABYLON.Color3.FromHexString(props.paintColor).asArray().concat([1.0]);

                // Store original colors before painting
                const originalColors = faceIndices.map(index => [
                    colorsData[index * 4],
                    colorsData[index * 4 + 1],
                    colorsData[index * 4 + 2],
                    colorsData[index * 4 + 3]
                ]);

                if (event.button === 0) { // Left mouse button is pressed
                    // Paint the selected face
                    faceIndices.forEach(index => {
                        colorsData[index * 4] = paintColorArray[0];
                        colorsData[index * 4 + 1] = paintColorArray[1];
                        colorsData[index * 4 + 2] = paintColorArray[2];
                        colorsData[index * 4 + 3] = paintColorArray[3];
                    });
                } else if (event.button === 2) { // Right mouse button is pressed
                    // Remove the paint from the selected face (reset to white)
                    faceIndices.forEach(index => {
                        colorsData[index * 4] = 1.0;
                        colorsData[index * 4 + 1] = 1.0;
                        colorsData[index * 4 + 2] = 1.0;
                        colorsData[index * 4 + 3] = 1.0;
                    });
                }

                pickedMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorsData);

                // Push the action to the stack
                actionStack.push({ type: 'paint', mesh: pickedMesh, faceIndices, originalColors });

                console.log('Face Painted:', faceIndices);
                break;
            case 'measure':
                measurePoints.push(pickResult.pickedPoint.clone());
                console.log('Picked Point:', pickResult.pickedPoint.clone());
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
                        console.log('Line Points:', measurePoints);

                        // Optionally, add text to display the distance
                        distanceText = new GUI.TextBlock();
                        distanceText.text = `${distance.toFixed(2)} mm`;
                        distanceText.color = "red";
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
        }
    }
};

const handleKeyDown = (event) => {
    if (event.key !== previousKey) {
        if (measurePoints.length > 0)
            clearMeasureElements();

        if (previousHighlightMesh) {
            glowLayer.removeIncludedOnlyMesh(previousHighlightMesh);
            previousHighlightMesh.dispose();
        }

        if (event.key === '1' || event.key === 'q') {
            emit('tool-changed', 'gizmo');
        } else if (event.key === '2' || event.key === 'w') {
            emit('tool-changed', 'paint');
        } else if (event.key === '3' || event.key === 'e') {
            emit('tool-changed', 'measure');
        } else if (event.ctrlKey && event.key === 'z') {
            props.undoLastAction();
        }
    }
    previousKey = event.key;
};
</script>