import { 
  WireframeLine, 
  SpaceShip, 
  RaceCamera, 
  Vec3, 
  Matrix4, 
  ProjectionResult 
} from "../types/spaceracing";

// 3D Wireframe renderer for Neon Racing 
export class WireframeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private useWebGL: boolean;
  private viewMatrix: Matrix4;
  private projMatrix: Matrix4;
  private width: number = 800;
  private height: number = 600;
  
  constructor(canvas: HTMLCanvasElement, forceCanvas2D = false) {
    this.canvas = canvas;
    this.useWebGL = false; // For now, use Canvas 2D only
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Could not get 2D rendering context");
    }
    this.ctx = ctx;
    
    this.viewMatrix = this.createMatrix4();
    this.projMatrix = this.createMatrix4();
    
    console.log("WireframeRenderer initialized with Canvas 2D");
  }
  
  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }
  
  setCamera(camera: RaceCamera): void {
    this.updateViewMatrix(camera);
    this.updateProjectionMatrix(camera);
  }
  
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw starfield background
    this.ctx.fillStyle = '#000011';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Add some stars for space ambiance
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      const size = Math.random() * 2;
      this.ctx.fillRect(x, y, size, size);
    }
  }
  
  drawWireframe(lines: WireframeLine[]): void {
    for (const line of lines) {
      this.drawLine3D(line.start, line.end, line.color, line.glow);
    }
  }
  
  drawLine3D(start: Vec3, end: Vec3, color: string, glow = false): void {
    const projectedStart = this.project3DTo2D(start);
    const projectedEnd = this.project3DTo2D(end);
    
    if (!projectedStart.visible || !projectedEnd.visible) {
      return; // Line is behind camera or outside view frustum
    }
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = glow ? 2 : 1;
    
    if (glow) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 8;
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(projectedStart.x, projectedStart.y);
    this.ctx.lineTo(projectedEnd.x, projectedEnd.y);
    this.ctx.stroke();
    
    if (glow) {
      this.ctx.shadowBlur = 0;
    }
  }
  
  drawShip(ship: SpaceShip, isPlayer: boolean): void {
    const projected = this.project3DTo2D(ship.position);
    if (!projected.visible) return;
    
    const size = isPlayer ? 8 : 6;
    const color = isPlayer ? '#00ffff' : '#ff00ff';
    
    this.ctx.fillStyle = color;
    if (isPlayer) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 12;
    }
    
    // Draw ship as a triangle pointing forward
    this.ctx.save();
    this.ctx.translate(projected.x, projected.y);
    this.ctx.rotate(ship.rotation.y); // Yaw rotation
    
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.6, size);
    this.ctx.lineTo(-size * 0.6, size);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw engine trail if moving fast
    if (ship.speed > ship.baseSpeed * 1.1) {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(-size * 0.3, size);
      this.ctx.lineTo(0, size + ship.speed * 0.02);
      this.ctx.moveTo(size * 0.3, size);
      this.ctx.lineTo(0, size + ship.speed * 0.02);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }
  
  drawPauseOverlay(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = '48px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.textAlign = 'start';
  }
  
  dispose(): void {
    // Nothing to dispose for Canvas 2D
  }
  
  private project3DTo2D(point: Vec3): ProjectionResult {
    // Simple perspective projection
    // Apply view transform (camera position/orientation)
    const viewPoint = this.transformPoint(point, this.viewMatrix);
    
    // Check if point is behind camera
    if (viewPoint.z <= 0.1) {
      return { x: 0, y: 0, z: viewPoint.z, visible: false };
    }
    
    // Perspective projection
    const fov = 75 * Math.PI / 180; // 75 degrees in radians
    const aspect = this.width / this.height;
    const focalLength = 1 / Math.tan(fov / 2);
    
    const projectedX = (viewPoint.x * focalLength) / (viewPoint.z * aspect);
    const projectedY = (viewPoint.y * focalLength) / viewPoint.z;
    
    // Convert to screen coordinates
    const screenX = (projectedX + 1) * this.width / 2;
    const screenY = (-projectedY + 1) * this.height / 2; // Flip Y
    
    // Check if point is within screen bounds (with some margin)
    const margin = 100;
    const visible = screenX >= -margin && screenX <= this.width + margin &&
                   screenY >= -margin && screenY <= this.height + margin;
    
    return {
      x: screenX,
      y: screenY,
      z: viewPoint.z,
      visible
    };
  }
  
  private updateViewMatrix(camera: RaceCamera): void {
    // Create look-at matrix
    // This is a simplified version - for full implementation would use proper matrix math
    this.viewMatrix = this.createLookAtMatrix(camera.position, camera.target, camera.up);
  }
  
  private updateProjectionMatrix(camera: RaceCamera): void {
    // Create perspective projection matrix
    const fov = camera.fov * Math.PI / 180;
    const aspect = this.width / this.height;
    const near = camera.near;
    const far = camera.far;
    
    this.projMatrix = this.createPerspectiveMatrix(fov, aspect, near, far);
  }
  
  private createMatrix4(): Matrix4 {
    return {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    };
  }
  
  private createLookAtMatrix(eye: Vec3, target: Vec3, up: Vec3): Matrix4 {
    // Simplified look-at matrix calculation
    const zAxis = this.normalize(this.subtract(eye, target));
    const xAxis = this.normalize(this.cross(up, zAxis));
    const yAxis = this.cross(zAxis, xAxis);
    
    return {
      elements: [
        xAxis.x, yAxis.x, zAxis.x, 0,
        xAxis.y, yAxis.y, zAxis.y, 0,
        xAxis.z, yAxis.z, zAxis.z, 0,
        -this.dot(xAxis, eye), -this.dot(yAxis, eye), -this.dot(zAxis, eye), 1
      ]
    };
  }
  
  private createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);
    
    return {
      elements: [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, near * far * rangeInv * 2, 0
      ]
    };
  }
  
  private transformPoint(point: Vec3, matrix: Matrix4): Vec3 {
    const m = matrix.elements;
    const x = point.x;
    const y = point.y;
    const z = point.z;
    
    return {
      x: m[0] * x + m[4] * y + m[8] * z + m[12],
      y: m[1] * x + m[5] * y + m[9] * z + m[13],
      z: m[2] * x + m[6] * y + m[10] * z + m[14]
    };
  }
  
  // Vector math helpers
  private subtract(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }
  
  private cross(a: Vec3, b: Vec3): Vec3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
  
  private dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  
  private normalize(v: Vec3): Vec3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) return { x: 0, y: 0, z: 1 };
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }
}