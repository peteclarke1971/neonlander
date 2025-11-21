import React, { useEffect, useRef } from 'react';

interface WaterFXRendererProps {
  enabled: boolean;
  className?: string;
}

export const WaterFXRenderer: React.FC<WaterFXRendererProps> = ({ enabled, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize WebGL
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.warn('WebGL not supported for water effect');
      return;
    }
    glRef.current = gl;

    // Vertex shader - simple pass-through
    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
      }
    `;

    // Fragment shader - water distortion and caustics
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = v_texCoord;
        
        // Sine wave distortion for water ripple
        float wave1 = sin(uv.x * 15.0 + u_time * 0.8) * 0.005;
        float wave2 = sin(uv.y * 20.0 - u_time * 1.2) * 0.004;
        vec2 distortedUV = uv + vec2(wave1, wave2);
        
        // Animated caustics (light patterns)
        float caustic1 = sin(distortedUV.x * 25.0 + u_time * 1.5) * 
                         cos(distortedUV.y * 30.0 - u_time * 1.8);
        float caustic2 = sin(distortedUV.x * 18.0 - u_time * 1.3) * 
                         cos(distortedUV.y * 22.0 + u_time * 1.6);
        float caustics = (caustic1 + caustic2) * 0.5;
        caustics = smoothstep(0.2, 0.8, caustics * 0.5 + 0.5);
        
        // Light blue tint with caustics
        vec3 waterColor = vec3(0.4, 0.7, 0.9);
        vec3 finalColor = waterColor * (0.15 + caustics * 0.25);
        
        gl_FragColor = vec4(finalColor, 0.25 + caustics * 0.15);
      }
    `;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) return;

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    // Create program
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    programRef.current = program;

    // Setup geometry (full-screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Setup attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gl && program) {
        gl.deleteProgram(program);
      }
    };
  }, []);

  // Render loop
  useEffect(() => {
    if (!enabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const render = () => {
      const canvas = canvasRef.current;
      const gl = glRef.current;
      const program = programRef.current;

      if (!canvas || !gl || !program) return;

      // Update canvas size
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const width = Math.floor(displayWidth * dpr);
      const height = Math.floor(displayHeight * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      // Clear and render
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Set uniforms
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      
      const time = (Date.now() - startTimeRef.current) / 1000;
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, width, height);

      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Force update on next render
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
      style={{
        width: '100%',
        height: '100%',
        mixBlendMode: 'screen'
      }}
    />
  );
};
