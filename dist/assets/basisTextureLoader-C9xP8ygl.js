import{T as p,L as f,a as i}from"./index-DQhdE7SZ.js";class m{constructor(){this.supportCascades=!1}loadCubeData(o,e,n,a,r){if(Array.isArray(o))return;const s=e.getEngine().getCaps(),c={supportedCompressionFormats:{etc1:!!s.etc1,s3tc:!!s.s3tc,pvrtc:!!s.pvrtc,etc2:!!s.etc2,astc:!!s.astc,bc7:!!s.bptc}};p(o,c).then(t=>{const l=t.fileInfo.images[0].levels.length>1&&e.generateMipMaps;f(e,t),e.getEngine()._setCubeMapTextureParams(e,l),e.isReady=!0,e.onLoadedObservable.notifyObservers(e),e.onLoadedObservable.clear(),a&&a()}).catch(t=>{i.Warn("Failed to transcode Basis file, transcoding may not be supported on this device"),e.isReady=!0,r&&r(t)})}loadData(o,e,n){const a=e.getEngine().getCaps(),r={supportedCompressionFormats:{etc1:!!a.etc1,s3tc:!!a.s3tc,pvrtc:!!a.pvrtc,etc2:!!a.etc2,astc:!!a.astc,bc7:!!a.bptc}};p(o,r).then(s=>{const c=s.fileInfo.images[0].levels[0],t=s.fileInfo.images[0].levels.length>1&&e.generateMipMaps;n(c.width,c.height,t,s.format!==-1,()=>{f(e,s)})}).catch(s=>{i.Warn("Failed to transcode Basis file, transcoding may not be supported on this device"),i.Warn(`Failed to transcode Basis file: ${s}`),n(0,0,!1,!1,()=>{},!0)})}}export{m as _BasisTextureLoader};
