
const cfg = require('./config.cjs');

//
class PathControls
{
    constructor(cam, nslides, path, markers, npoints, webgl_container, pdf_container, 
                render_page_callback)
    {
        this.current_marker = -1;
        this.delta_pos = 0.1 / nslides;
        this.marker_dist_stop = cfg.path_control.marker_dist_stop;
        this.frac_on_path = 0.0;            // [0..1] for whole path.
        this.frac_on_marker_path = 0.0;     // [0..n/N] for inter-marker segments
        this.frac_inter_marker = 0.0;       // [0..1] for inter-marker segments.
        this.n_points_on_path = npoints;
        this.max_marker_points = 0;
        this.base_mv_speed = cfg.path_control.base_mv_speed / nslides;
        this.step_speed = cfg.path_control.step_speed;
        this.min_speed = cfg.path_control.min_speed;
        this.max_speed = cfg.path_control.max_speed;

        //
        this.cam = cam;
        this.path = path;
        this.markers = markers;
        this.marker_steps = [];
        this.marker_fracs_cum = [];
        this.marker_fracs = [];
        this.mv_speed = [];

        //
        this.slide_render_callback = render_page_callback;

        // transforms
        this.transform_speed = cfg.path_control.transform_speed;
        this.webgl_opacity = 1.0;
        this.webl_min_opacity = cfg.path_control.webl_min_opacity;
        this.webgl_dt = (this.webgl_opacity - this.webl_min_opacity) * this.transform_speed;
        this.slide_opacity = 0.0;
        this.slide_dt = 1.0 * this.transform_speed;
        this.next_action = -1;
        this.transform_on_path = cfg.path_control.transform_on_path;
        this.transform_on_path_frac = cfg.path_control.transform_on_path_frac;
        this.webgl_container = webgl_container;
        this.pdf_container = pdf_container;

        // state machine
        this.at_marker = false;
        this.is_stepping = false;
        this.is_transforming_into = false;
        this.is_displaying_slide = false;
        this.is_transforming_from = false;
        this.is_transforming_on_path = false;

        // calc steps between all markers for later interpolation
        this.calc_marker_step_distances_();

    }

    debug_state() {
        console.log('==============================================');
        console.log('this.at_marker: ', this.at_marker);
        console.log('this.is_stepping: ', this.is_stepping);
        console.log('this.is_transforming_into: ', this.is_transforming_into);
        console.log('this.is_displaying_slide: ', this.is_displaying_slide);
        console.log('this.is_transforming_from: ', this.is_transforming_from);
        console.log('this.next_action: ', this.next_action);
        console.log('this.is_transforming_on_path: ', this.is_transforming_on_path);
    }
    //
    calc_marker_step_distances_()
    {
        let frac_on_path_ = 0.0;
        let nsteps = 0;
        let next_marker = 0;
        let next_marker_z = this.markers[next_marker].position.z;
        let this_frac = 0.0;

        while (frac_on_path_ < 1.0)
        {
            let pos0 = this.path.getPointAt(frac_on_path_);
        
            if (Math.abs(pos0.z - next_marker_z) < this.marker_dist_stop)
            {
                this.marker_steps.push(nsteps);
                this.marker_fracs.push(this_frac);
                this.marker_fracs_cum.push(frac_on_path_);
                this.max_marker_points = Math.max(this.max_marker_points, nsteps);
                nsteps = 0;
                this_frac = 0.0;
                next_marker = (next_marker + 1) % this.markers.length;
                next_marker_z = this.markers[next_marker].position.z;
            }
        
            let dist = this.step_speed / this.n_points_on_path;
            frac_on_path_ += dist;
            this_frac += dist;
            nsteps++;
        }

    }

    //
    mv_cam_to(to_where=0.0, delta_pos=this.delta_pos)
    {
        this.is_stepping = false;

        let pos0 = this.path.getPointAt(to_where);
        let pos1 = this.path.getPointAt(to_where + delta_pos);
        this.cam.position.set(pos0.x, pos0.y + 4, pos0.z);
        this.cam.lookAt(pos1.x, pos1.y + 4, pos1.z);
        this.frac_on_path = to_where;
    }

    //
    jmp_marker(to_marker)
    {
        this.is_stepping = false;

        if (to_marker == this.current_marker)
            return;

        // console.log('jmp_marker: ', this.current_marker, ' -> ', to_marker);

        // calculate the offset in [0..1] into path based on marker count
        let marker_z = this.markers[to_marker].position.z - this.marker_dist_stop;
        let pos0;
        let frac_on_path_ = this.frac_on_path
        
        if (to_marker < this.current_marker)   // reverse jumping
            frac_on_path_ = 0.0;

        while (frac_on_path_ < 1.0)
        {
            pos0 = this.path.getPointAt(frac_on_path_);
        
            if (Math.abs(pos0.z - marker_z) < this.marker_dist_stop)
                break;
        
            frac_on_path_ += 0.02 / this.n_points_on_path;
        }

        // update global state
        this.frac_on_path = frac_on_path_;

        let pos1 = this.markers[to_marker].position;
        this.cam.position.set(pos0.x, pos0.y + 4, pos0.z);
        this.cam.lookAt(pos1.x, pos1.y - 4, pos1.z);

        this.at_marker = true;
        this.is_transforming_into = true;
    }

    //
    jmp_prev_marker()
    {
        this.at_marker = false;
        let prev_marker = (this.current_marker - 1) % this.markers.length;
        if (prev_marker < 0)
            prev_marker = 0;
        this.jmp_marker(prev_marker);
        this.current_marker = prev_marker;
    }

    //
    jmp_next_marker()
    {
        this.at_marker = false;
        let next_marker = (this.current_marker + 1) % this.markers.length;
        this.jmp_marker(next_marker);
        this.current_marker = next_marker;
    }

    //
    mv_next_marker()
    {
        this.at_marker = false;
        if (this.is_stepping)
            return;

        let next_marker = (this.current_marker + 1) % this.markers.length;

        if (next_marker == this.markers.length)
            return false;

        this.is_stepping = true;
        // update current marker (since we're moving there)
        this.current_marker = next_marker;
        // reset this marker path fractions
        this.frac_on_marker_path = 0.0;
        this.frac_inter_marker = 0.0;
        // precalculate speeds from a gaussian
        let nsteps = this.marker_steps[this.current_marker];
        this.mv_speed = [];
        
        // helper functions
        let gaussian_ = function(x, m, s)
        {
            return 1.0 / (s * Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * (((x - m) / s)**2));
        }
        //
        let norm_ = function(x, xmin, xmax, gmin, gmax)
        {
            let norm01 = (x - xmin) / (xmax - xmin);
            return (gmax - gmin) * norm01 + gmin;
        }

        let xrange = 5.0 - (-5.0);
        let xstep  = xrange / nsteps;
        let x = -5.0;
        let ymax = -100;
        let ymin =  100;
        for (let i = 0; i < nsteps; i++)
        {
            // let speed = gaussian_(x, 0.0, 1.6);
            let speed = gaussian_(x, 0.0, cfg.path_control.gaussian_sigma);
            ymin = Math.min(ymin, speed);
            ymax = Math.max(ymax, speed);
            this.mv_speed.push(speed);
            x += xstep;
        }
        // normalize mv_speed to range [this.min_speed ... this.max_speed]
        for (let i = 0; i < this.mv_speed.length; i++)
        {
            this.mv_speed[i] = norm_(this.mv_speed[i], ymin, ymax, this.min_speed, this.max_speed);
        }

        return true;
    }

    //
    step_path()
    {
        // distance from next marker to stop
        let next_marker_z = this.markers[this.current_marker].position.z;

        this.is_stepping = true;

        let dist_to_next_marker = Math.abs(next_marker_z - this.cam.position.z);

        // reached marker
        if (dist_to_next_marker < this.marker_dist_stop && !this.transform_on_path) {
            this.at_marker = true;
            this.is_stepping = false;
            this.is_transforming_into = true;
        }

        // state change when transforming on path
        else if (dist_to_next_marker < this.marker_dist_stop && this.transform_on_path) {
            this.at_marker = true;
            this.is_stepping = false;
            this.is_transforming_into = false;
            this.is_transforming_on_path = false;
            this.webgl_container.style.opacity = this.webl_min_opacity;
            this.pdf_container.style.opacity = 1.0;
        }

        else {
            let speed_idx = Math.round((this.frac_on_marker_path / this.marker_fracs[this.current_marker]) * this.marker_steps[this.current_marker]);

            if (speed_idx >= this.mv_speed.length)
                speed_idx = this.mv_speed.length - 1;

            let dist = (this.base_mv_speed * this.mv_speed[speed_idx]) / (this.max_marker_points / this.marker_steps[this.current_marker]);

            // take step along path
            if ((this.frac_on_path + this.delta_pos) < 1.0 && this.is_stepping)
            {
                let pos0 = this.path.getPointAt(this.frac_on_path);
                let pos1;
                try
                {
                    pos1 = this.path.getPointAt(this.frac_on_path + this.delta_pos);
                    pos1.y += 4;
                }
                catch(e)
                {
                    pos1 = this.markers[this.current_marker].position;
                    pos1.y -= 4;
                }

                this.cam.position.set(pos0.x, pos0.y + 4, pos0.z);
                this.cam.lookAt(pos1.x, pos1.y, pos1.z);
    
                // update location
                this.frac_on_path += dist;
                this.frac_on_marker_path += dist;
            }
    
            // last marker, special treatment
            else if ((this.frac_on_path) < 1.0 && this.is_stepping)
            {
                let pos0 = this.path.getPointAt(this.frac_on_path);
                let pos1 = this.markers[this.current_marker].position;
                this.cam.position.set(pos0.x, pos0.y + 4, pos0.z);
                this.cam.lookAt(pos1.x, pos1.y - 4, pos1.z);
    
                // update state
                this.frac_on_path += dist;
                this.frac_on_marker_path += dist;
            }

            // this.marker_fracs[this.current_marker] contain the length of total path ([0..1])
            // for the current inter-marker segment
            //
            // (this.frac_on_marker_path / this.marker_fracs[this.current_marker]) --> [0..1] on this inter-segment path
            //
            this.frac_inter_marker = (this.frac_on_marker_path / this.marker_fracs[this.current_marker]);
            // console.log('this.frac_inter_marker:', this.frac_inter_marker);

            if (this.transform_on_path && this.frac_inter_marker > this.transform_on_path_frac) {
                if (!this.is_transforming_on_path) {
                    // render page (once)
                    this.slide_render_callback(this.current_marker);
                    this.is_transforming_on_path = true;
                }
                
                this.slide_opacity = (this.frac_inter_marker - this.transform_on_path_frac) / 
                                     (1.0 - this.transform_on_path_frac);
                // this.pdf_container.style.opacity = Math.min(opacity, 1.0);
                this.pdf_container.style.opacity = this.slide_opacity;

                // don't fade out scene, set (above) when pdf is faded in
                //let webgl_dt = (this.webgl_opacity - this.webl_min_opacity)...

                this.is_displaying_slide = true;
            }
            
        }
        
    }

    //
    transform_to()
    {
        if (!this.is_displaying_slide) {
            this.slide_render_callback(this.current_marker);
        }

        this.is_displaying_slide = true;

        // fade out geometry and fade in slide (over 0.5 s)
        if (this.webgl_opacity > 0.0) {
            this.webgl_opacity -= this.webgl_dt;
        }
        this.webgl_container.style.opacity = this.webgl_opacity;

        if (this.slide_opacity < 1.0) {
            this.slide_opacity += this.slide_dt;
        }
        this.pdf_container.style.opacity = this.slide_opacity;

        // set state flags
        if (this.slide_opacity >= 1.0 && this.webgl_opacity <= this.webl_min_opacity) {
            this.webgl_opacity = this.webl_min_opacity;
            this.slide_opacity = 1.0;
            this.is_transforming_into = false;
        }
    }

    //
    transform_from()
    {
        this.is_transforming_from = true;

        if (this.webgl_opacity < 1.0) {
            this.webgl_opacity += this.webgl_dt;
        }
        this.webgl_container.style.opacity = this.webgl_opacity;

        if (this.slide_opacity > 0.0) {
            this.slide_opacity -= this.slide_dt;
        }
        this.pdf_container.style.opacity = this.slide_opacity;

        // set state flags
        if (this.webgl_opacity >= 1.0 && this.slide_opacity <= 0.0) {
            this.webgl_opacity = 1.0;
            this.slide_opacity = 0.0;
            this.is_displaying_slide = false;
            this.is_transforming_from = false;

            // next action
            if (this.next_action < 0) { 
                return;
            }

            switch (this.next_action) {
                case 0: this.next_action = -1; this.jmp_next_marker(); break;
                case 1: this.next_action = -1; this.jmp_prev_marker(); break;
                case 2: this.next_action = -1; this.mv_cam_to(0.0); this.current_marker = -1; break;
                case 3: this.next_action = -1; this.mv_next_marker(); break;
            }
        }
    }

}

module.exports = { PathControls };
