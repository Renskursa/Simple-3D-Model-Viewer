import { ISceneLoaderPluginAsync } from "@babylonjs/core/Loading/sceneLoader";
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

class FbxImporter {
    constructor(options) {
        this.name = "fbxImporter";
        this.extensions = ".fbx";
        this.options = options;
    }

    async importMeshAsync(scene, data, rootUrl, fileName) {
        return this.loadAsync(scene, data, rootUrl, fileName);
    }

    async loadAsync(scene, data, rootUrl, fileName) {
        const loader = new FBXLoader();
        return new Promise((resolve, reject) => {
            loader.load(rootUrl + fileName, (object) => {
                scene.add(object);
                resolve(object);
            }, undefined, (error) => {
                reject(error);
            });
        });
    }

    async loadAssetContainerAsync(scene, data, rootUrl, fileName) {
        const container = new BABYLON.AssetContainer(scene);
        const object = await this.loadAsync(scene, data, rootUrl, fileName);
        container.meshes.push(object);
        return container;
    }
}

export default FbxImporter;