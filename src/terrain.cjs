
const THREE = require('three');
const Perlin = require('./noise.cjs').Perlin;
const cfg = require('./config.cjs');

//
class Chunk
{
    constructor(dim, res, v_chunk, scene_obj, perlin)
    {
        this.dim = dim;
        this.res = res;
        
        this.scene = scene_obj;

        this.v_chunk = v_chunk;

        this.chunk_geom = new THREE.PlaneGeometry(this.dim, this.dim, this.res, this.res);
        // this.chunk_geom.deleteAttribute('normal');
        this.chunk_geom.deleteAttribute('uv');
        // this.chunk_mat  = new THREE.MeshStandardMaterial({ color: 0x808080, wireframe: true, side: THREE.FrontSide });
        this.chunk_mat  = new THREE.MeshLambertMaterial({ color: 0xb0b0b0, side: THREE.BackSide }); //wireframe: true, side: THREE.FrontSide });
        this.chunk_mesh = new THREE.Mesh(this.chunk_geom, this.chunk_mat);
        this.chunk_mesh.position.set(this.v_chunk.x * this.dim, 0, this.v_chunk.z * this.dim);
        this.scene.add(this.chunk_mesh);

        // let perlin = new Perlin(settings.NOISE_SEED);
        let vertices = this.chunk_mesh.geometry.attributes.position.array;
        
        for (let i = 0; i <= vertices.length; i += 3)
        {
            // swap y and z
            let y = vertices[i+1];
            vertices[i+1] = vertices[i+2];
            vertices[i+2] = y;
        
            // noise offset in y
            vertices[i+1] = perlin.octave_noise(
                (this.chunk_mesh.position.x + vertices[i+0]),
                (this.chunk_mesh.position.z + vertices[i+2]),
                cfg.terrain.octaves,
                cfg.terrain.max_height,
                cfg.terrain.smoothing
            );
        }
        
        this.chunk_mesh.geometry.attributes.position.needsUpdate = true;
        this.chunk_mesh.geometry.computeVertexNormals();

    }

}

//
class ChunkManager
{
    constructor(dim=1024, res=128, scene_obj)
    {
        this.dim = dim;
        this.res = res;

        this.scene = scene_obj;

        this.chunk_map = new Map();

        this.perlin = new Perlin(cfg.terrain.seed);

    }

    // path_vert_array contains the vertices of the path
    construct_chunks(path_vert_array)
    {
        for (const v of path_vert_array)
        {
            let vc = new THREE.Vector3(Math.round(v.x / this.dim), 0, Math.round(v.z / this.dim));
            // let key = vc.x+'_'+vc.z;
            let keys = [
                (vc.x-1)+'_'+(vc.z-1),
                (vc.x+0)+'_'+(vc.z-1),
                (vc.x+1)+'_'+(vc.z-1),
                (vc.x-1)+'_'+(vc.z+0),
                (vc.x+0)+'_'+(vc.z+0),
                (vc.x+1)+'_'+(vc.z+0),
                (vc.x-1)+'_'+(vc.z+1),
                (vc.x+0)+'_'+(vc.z+1),
                (vc.x+1)+'_'+(vc.z+1),
            ];
            
            for (const key of keys)
            {
                if (!this.chunk_map.has(key))
                    this.chunk_map.set(key, new Chunk(this.dim, this.res, vc, this.scene, this.perlin));
            }            
        }    


    }

}

// exports.Chunk = Chunk
exports.ChunkManager = ChunkManager
