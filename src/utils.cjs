let m_w = 123456789;
let m_z = 987654321;
let mask = 0xffffffff;

//
function set_seed(i)
{
    m_w = (123456789 + i) & mask;
    m_z = (987654321 - i) & mask;
}

//
const map = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2;

//
function rand_float(lo=0.0, hi=1.0) 
{
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    var res = ((m_z << 16) + (m_w & 65535)) >>> 0;
    res /= 4294967296;
    // now in [0..1], scale and shift accordingly
    res = map(res, 0, 1, lo, hi);
    return res;
}

module.exports = { rand_float, set_seed };