use std::mem;
use std::slice;
use std::os::raw::c_void;

#[no_mangle]
#[derive(Clone, Copy)]
pub struct Vertex {
    x: f64,
    y: f64,
    vx: f64,
    vy: f64
}

fn modulo(n: i32, m: i32) -> usize {
  return (((n % m) + m) % m) as usize;
}

fn cap(x: f64, cap: f64) -> f64 {
    if x > cap { return cap; }
    if x < -cap { return -cap; }
    return x;
}

extern "C" {
    fn log(x: f64);
}

// Credit to https://www.hellorust.com/demos/canvas/index.html

// We need to provide an (empty) main function,
// as the target currently is compiled as a binary.
fn main() {}

// In order to work with the memory we expose (de)allocation methods
#[no_mangle]
pub extern "C" fn alloc(count: usize) -> *mut c_void {
    let mut buf = Vec::with_capacity(count * mem::size_of::<Vertex>());
    let ptr = buf.as_mut_ptr();
    mem::forget(buf);
    return ptr as *mut c_void;
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut c_void, cap: usize) {
    unsafe  {
        let _buf = Vec::from_raw_parts(ptr, 0, cap);
    }
}

#[no_mangle]
pub fn init(pointer: *mut Vertex, count: usize, radius: f64) {
    let byte_size = count * mem::size_of::<Vertex>();
    let data: &mut [Vertex] = unsafe { slice::from_raw_parts_mut(pointer, byte_size) };
    for i in 0..count {
        data[i] = Vertex {
            x: radius * (i as f64 / count as f64 * 6.28318).cos(),
            y: radius * (i as f64 / count as f64 * 6.28318).sin(),
            vx: 0.0,
            vy: 0.0
        }
    }
}

const GRAVITY: f64 = 0.0005;
const TENSION: f64 = 0.06;
const DRAG_TENSION: f64 = 0.00008;
const PRESSURE: f64 = 0.01;
const FRICTION: f64 = 0.7;
const DECAY: f64 = 0.999985;
const BOUNCE: f64 = 0.9;

#[no_mangle]
pub fn step(pointer: *mut Vertex, count: i32, radius: f64, width: f64, height: f64, drag: bool, dragx: f64, dragy: f64, time: f64) {
    let byte_size = count as usize * mem::size_of::<Vertex>();
    let vertices: &mut [Vertex] = unsafe { slice::from_raw_parts_mut(pointer, byte_size) };

    let mut avgx = 0.0;
    let mut avgy = 0.0;
    let mut area = 0.0;

    let resting_edge_length = radius * 6.28318 / count as f64;
    let resting_area = radius * radius * 3.14159;

    for i in 0..count {
        let vertex = vertices[i as usize];
        let next = vertices[modulo(i + 1, count)];
        area += vertex.x * next.y - vertex.y * next.x;
        avgx += vertex.x;
        avgy += vertex.y;
    }

    area /= 2.0;

    avgx /= count as f64;
    avgy /= count as f64;

    for i in 0..count {
        let last = vertices[modulo((i - 1), count)];
        let mut vertex = vertices[i as usize];
        let next = vertices[modulo((i + 1), count)];

        let mut ax = 0.0;
        let mut ay = 0.0;

        // Pull vertex towards its neighbors
        {
            let dx = last.x - vertex.x;
            let dy = last.y - vertex.y;
            let d2 = dx * dx + dy * dy;
            let d = d2.sqrt();
            ax += (dx / d) * TENSION * (d - resting_edge_length);
            ay += (dy / d) * TENSION * (d - resting_edge_length);
        }
        {
            let dx = next.x - vertex.x;
            let dy = next.y - vertex.y;
            let d2 = dx * dx + dy * dy;
            let d = d2.sqrt();
            ax += (dx / d) * TENSION * (d - resting_edge_length);
            ay += (dy / d) * TENSION * (d - resting_edge_length);
        }

        // Push vertex out, normal to the edge
        // To do this, calculate average position of neighboring vertices
        {
            let mut lastx = 0.0;
            let mut lasty = 0.0;
            let mut nextx = 0.0;
            let mut nexty = 0.0;
            for j in 1..4 {
                // previous few vertices
                lastx += vertices[modulo(i - j, count)].x;
                lasty += vertices[modulo(i - j, count)].y;
            }
            for j in 1..4 {
                // next few vertices
                nextx += vertices[modulo(i + j, count)].x;
                nexty += vertices[modulo(i + j, count)].y;
            }
            let dx = (nextx - lastx) / 3.0;
            let dy = (nexty - lasty) / 3.0;
            let d2 = dx * dx + dy * dy;
            let d = d2.sqrt();
            ax += (dy / d) * PRESSURE * (resting_area / area);
            ay += (-dx / d) * PRESSURE * (resting_area / area);
        }

        // Pull vertex toward mouse, as though attached by a spring to dragx
        if drag {
            let dx = dragx - avgx;
            let dy = dragy - avgy;
            let d2 = dx * dx + dy * dy;
            let d = d2.sqrt();
            ax += (dx / d) * DRAG_TENSION * d;
            ay += (dy / d) * DRAG_TENSION * d;
        }

        vertex.vx += cap(ax, 1.0) * time;
        vertex.vy += cap(ay, 1.0) * time;
        vertex.vx *= DECAY;
        vertex.vy *= DECAY;
        vertex.vy += GRAVITY * time;
        vertices[i as usize] = vertex;
    }

    for i in 0..(count as usize) {
        let vertex = &mut vertices[i];

        vertex.x += vertex.vx * time;
        vertex.y += vertex.vy * time;
    }

    // Collision detection
    for i in 0..(count as usize) {
        let vertex = &mut vertices[i];
        let ybound = height / 2.0;
        let xbound = width / 2.0;
        if vertex.y > ybound {
            vertex.y = ybound;
            vertex.vy = -vertex.vy * BOUNCE;
            vertex.vx *= FRICTION;
        }

        if vertex.y < -ybound {
            vertex.y = -ybound;
            vertex.vy = -vertex.vy * BOUNCE;
            vertex.vx *= FRICTION;
        }

        if vertex.x > xbound {
            vertex.x = xbound;
            vertex.vx = -vertex.vx * BOUNCE;
            vertex.vy *= FRICTION;
        }

        if vertex.x < -xbound {
            vertex.x = -xbound;
            vertex.vx = -vertex.vx * BOUNCE;
            vertex.vy *= FRICTION;
        }
    }
}
