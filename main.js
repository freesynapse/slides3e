
// import * as THREE from 'three';
const THREE = require('three');
const fs = require('fs');
const Stats = require('stats.js');
const MeshLine = require('three.meshline').MeshLine;
const MeshLineMaterial = require('three.meshline').MeshLineMaterial;

import { EffectComposer } from 'EffectComposer';
import { RenderPass } from 'RenderPass';
import { UnrealBloomPass } from 'UnrealBloomPass';
import { OutputPass } from 'OutputPass';

const { Perlin } = require('./src/noise.cjs');
const { ChunkManager } = require('./src/terrain.cjs');
const { PathControls } = require('./src/path_control.cjs');
const { rand_float, set_seed } = require('./src/utils.cjs');
const settings = require('./src/settings.cjs');

import * as pdfjs from './node_modules/pdfjs-dist/build/pdf.min.mjs';
import * as pdfjs_worker from './node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

let pdf_doc;
let pdf_pages;
let pdf_container_ctx2d;

let scene, cam, renderer, render_scene, bloom_pass, out_pass, composer, clock, stats, webgl_container, pdf_container,
    n_slides, segments_per_slide, markers, chunk_manager, line_point_count, path, line_mesh, ambient_light, 
    dir_light, last_key, pc;

// setup slides, waiting for pdf pages to load before loading the scene
const pdf_load_task = pdfjsLib.getDocument('./presentations/example.pdf');
pdf_load_task.promise.then(pdf_document => {
    console.log('loading pdf...');
    // store handle
    pdf_doc = pdf_document;
    pdf_container = document.getElementById("pdf_container");
    pdf_container_ctx2d = pdf_container.getContext('2d');
    console.log(pdf_doc);
    
    // cache the whole presentation
    n_slides = pdf_doc.numPages;
    load_pages().then(result => {
        console.log(result);
        console.log(pdf_pages);
        // render_page(curr_page);
        init_webgl();
    }).catch(e => {
        console.error(e);
    });
});

//
async function load_pages() {
    console.log('loading pdf pages...');
    pdf_pages = [];
    try {
        for (let i = 1; i <= pdf_doc.numPages; i++) {
            let p = await pdf_doc.getPage(i);
            pdf_pages.push(p);
        }
        return true;
    }
    catch (e) {
        console.log(e);
        throw e;
    }
}


//
function render_page(page_num) {
	try {
        const page = pdf_pages[page_num];
		const scale = 4.0;
		const viewport = page.getViewport({ scale });
		const canvas = pdf_container;
		canvas.height = viewport.height;
		canvas.width = viewport.width;
		const render_ctx = {
			canvasContext: pdf_container_ctx2d,
			viewport,
		};
		page.render(render_ctx);
	} 
    catch (error) {
		console.error(error);
	}
}


// initalization
function init_webgl() {
    console.log('initializing webgl scene.');

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.005);
    
    cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

    // scene rendering target
    webgl_container = document.getElementById("webgl");
    
    // WebGL renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: webgl_container,
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    // bloom filter
    render_scene = new RenderPass(scene, cam);
    bloom_pass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloom_pass.threshold = 0.0;
    bloom_pass.strength = 0.3;
    bloom_pass.radius = 0.0;
    out_pass = new OutputPass();
    composer = new EffectComposer(renderer);
    composer.addPass(render_scene);
    composer.addPass(bloom_pass);
    composer.addPass(out_pass);

    // misc
    clock = new THREE.Clock();

    stats = new Stats();
    // document.body.appendChild(stats.dom);

    // line from curve geometry
    // https://discourse.threejs.org/t/tube-from-3d-points/29585/9
    // https://discourse.threejs.org/t/tubegeometry-problems-with-path-parameter/3634/2
    // n_slides = 20;  // number of markers
    console.log('n_slides: ', n_slides);
    segments_per_slide = 3;
    let N = n_slides * segments_per_slide;  // number of line segments
    let z0 = 0;  // initial z position
    let step = 100; // increase in z for every N
    let path_points = [ new THREE.Vector3( 0, 0, z0 ) ];  // starting point
    markers = [];

    //
    chunk_manager = new ChunkManager(1024, 128, scene);

    //
    set_seed(3);
    let marker_texture = new THREE.TextureLoader().load('./assets/wp_marker.png');
    let marker_mat = new THREE.SpriteMaterial({ map: marker_texture, color: 0xff0000 });
    //
    for (let i = 1; i <= N; i++)
    // for (let i = 0; i <= N; i++)
    {
        let v = new THREE.Vector3();
        v.x = rand_float(-30.0, 30.0);
        v.y = rand_float(0.0, 0.0);
        // v.z = z0 + step * (i + 1);
        v.z = z0 + step * i;
        path_points.push(v);
        
        // create spheres along the way
        if (i % segments_per_slide == 0)
        {
            // billboarded markers = sprites
            let sprite = new THREE.Sprite(marker_mat);
            sprite.position.set(v.x, 0, v.z);
            // console.log(i % segments_per_slide, sprite.position.z);
            sprite.scale.set(5, 5, 1);
            scene.add(sprite);
            markers.push(sprite);
        }

    }

    chunk_manager.construct_chunks(path_points);
    // adjust path and sprite y values from terrain
    let path_y_offset = 40;
    let marker_y_offset = 8;
    let perlin = new Perlin(settings.NOISE_SEED);
    for (var point of path_points) 
    { 
        point.y = perlin.octave_noise(point.x, point.z, settings.OCTAVES, settings.MAX_HEIGHT, settings.SMOOTHING);
        point.y += path_y_offset;
    }
    for (var marker of markers)
    {
        let pos = marker.position;
        pos.y = perlin.octave_noise(pos.x, pos.z, settings.OCTAVES, settings.MAX_HEIGHT, settings.SMOOTHING);
        pos.y += (path_y_offset + marker_y_offset);
        marker.geometry.attributes.position.needsUpdate = true;
    }

    // line from points
    line_point_count = N * 50;
    path = new THREE.CatmullRomCurve3(path_points);
    let line_geometry = new THREE.BufferGeometry().setFromPoints(path.getPoints(line_point_count));

    // MeshLine: custom line from tris, 'override' for GL_LINES
    // https://syntaxbytetutorials.com/three-js-drawing-smooth-lines-with-webgl/
    let line = new MeshLine();
    line.setGeometry(line_geometry);
    let line_material = new MeshLineMaterial({ color: 0xffffff, linewidth: 10, fog: true });
    line_mesh = new THREE.Mesh(line, line_material);
    scene.add(line_mesh);

    // lighting
    ambient_light = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambient_light);
    dir_light = new THREE.DirectionalLight(0xffffff, 1.0);
    dir_light.position.set(1, 1, -1);
    scene.add(dir_light);

    // MOVING BETWEEN SLIDES (markers)
    //
    last_key = '';

    // path movement controls
    pc = new PathControls(cam, n_slides, path, markers, line_point_count);
    pc.mv_cam_to(0.0);

    // enter render loop
    render();
}


// the rendering loop
function render()
{
    const dt = clock.getDelta();
    requestAnimationFrame(render);
    
    // composer.render();
    renderer.render(scene, cam);
    
    stats.update();

    if (last_key != '')
    {
        // state of the path controller, where are we?
        if (!pc.is_displaying_slide) {
            if      (last_key == 'n') { pc.jmp_next_marker(); }
            else if (last_key == 'p') { pc.jmp_prev_marker(); }
            else if (last_key == 'r') { pc.mv_cam_to(0.0); pc.current_marker = -1; }
            else if (last_key == ' ') { pc.mv_next_marker(); }
        }
        else if (pc.is_displaying_slide) {
            if      (last_key == 'n') { pc.transform_from(webgl_container, pdf_container); pc.next_action = 0; }
            else if (last_key == 'p') { pc.transform_from(webgl_container, pdf_container); pc.next_action = 1; }
            else if (last_key == 'r') { pc.transform_from(webgl_container, pdf_container); pc.next_action = 2; }
            else if (last_key == ' ') { pc.transform_from(webgl_container, pdf_container); pc.next_action = 3; }
        }

        last_key = '';
    }

    // follow path to next marker
    if (pc.is_stepping) {
        pc.step_path();
    }
    // reached marker -- show slide
    else if (pc.is_transforming_into) {
        pc.transform_to(webgl_container, pdf_container, render_page);
    }
    // fading out slide
    else if (pc.is_transforming_from) {
        pc.transform_from(webgl_container, pdf_container);
    }
}

//
window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    last_key = event.key;
});


//
window.addEventListener('resize', function () {
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width,height);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
});

// run the thing
init_webgl();


