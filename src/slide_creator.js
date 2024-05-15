
const fs = require('fs');

//
/*
export class SlideCreator
{
    constructor(slide_count)
    {
        this.n = slide_count;
        this.slides = [];   // text representation, maybe remove?

        this.collect_slides();
    }
    
    //
    collect_slides() {
        console.log('hi');

        for (let i = 0; i < this.n; i++) {
            let fn = './slides/'+i.toString()+'.html';
            console.log('reading file', fn);
            let data = fs.readFileSync(fn, {encoding: 'utf8', flag: 'r'});
            this.slides.push(data);
        }
        
        console.log(this.slides);

    }
}
*/
