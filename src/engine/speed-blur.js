import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// A bounded, single-frame shutter blur. It never accumulates ghost frames or blurs HUD text.
export function createSpeedBlur() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      amount: { value: 0 },
      turn: { value: 0 },
      aspect: { value: 1 },
      cockpit: { value: 0 },
      focus: { value: new THREE.Vector2(0.5, 0.54) },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float amount,turn,aspect,cockpit;uniform vec2 focus;varying vec2 vUv;
    void main(){
      vec2 fromFocus=vUv-focus;
      float radius=length(fromFocus*vec2(aspect,1.0));
      float mask=smoothstep(0.10,0.72,radius);
      // Keep the car and the cockpit instruments readable.
      mask*=mix(1.0,smoothstep(0.26,0.45,vUv.y),cockpit);
      vec2 velocity=(fromFocus*amount+vec2(turn,0.0))*mask;
      vec4 color=vec4(0.0);float weight=0.0;
      for(int i=0;i<9;i++){
        float t=float(i)/8.0-0.5;
        float w=1.0-abs(t)*1.25;
        color+=texture2D(tDiffuse,clamp(vUv+velocity*t,vec2(0.001),vec2(0.999)))*w;weight+=w;
      }
      gl_FragColor=color/weight;
    }`,
  });
  pass.enabled = false;
  return pass;
}
