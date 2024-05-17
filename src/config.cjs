
const cfg = {
    app: {
        esc_repeat_to_quit: 3
    },

    terrain: {
        // Perlin noise parameters
        seed: 3,
        max_height: 150,
        smoothing: 0.0005,
        octaves: 9
    },
    
    path_control: {
        // How far from the marker should we stop?
        marker_dist_stop: 10,
        
        // Base move speed.
        base_mv_speed: 0.005,
        step_speed: 0.5,
        
        // Scaling factors for the speed function.
        min_speed: 0.6,
        max_speed: 2.8,                 
        
        // S.D. of the speed function.
        gaussian_sigma: 3.0,
        
        // Lower is faster.
        transform_speed: 0.01,
        
        // Minimum opacity of webgl canvas
        webl_min_opacity: 1.0,
        
        // Start transform while decelerating?
        transform_on_path: true,        
        
        // At which fraction of path should we start transform?
        // The speed at which we transform is decided by this so that the 
        // transform is finished at marker stop.
        transform_on_path_frac: 0.90
    },

    markers: {
        texture_filename: './assets/wp_marker.png',
        color: 0xed3c02 // 0xff0000
    },

    scene: {
        use_bloom: false
    }
    
};

module.exports = cfg;

