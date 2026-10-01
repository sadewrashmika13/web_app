const express = require('express');
const axios = require('axios');
const router = express.Router();

const DINKA_API = "https://kavindu-download-web.vercel.app/api/dinkamovies/movie";

// 1. DinkaMovies Search API එක
router.post('/api/dinkamovies/search', async (req, res) => {
    const { query } = req.body;
    try {
        const searchRes = await axios.get(`${DINKA_API}/search?q=${encodeURIComponent(query)}`);
        
        // Results ආවොත් Web එකට ඕන විදිහට Format කරලා යවනවා
        if (searchRes.data?.status && searchRes.data.data?.length > 0) {
            const results = searchRes.data.data.slice(0, 8).map(mv => ({
                title: mv.title || "Unknown",
                url: mv.link || mv.url,
                img: mv.poster || '', 
                source: 'dinkamovies' // Source එක අනිවාර්යයෙන් දානවා
            }));
            return res.json({ success: true, results });
        }
        res.json({ success: false });
    } catch (error) {
        console.error("Dinka Search Error:", error.message);
        res.json({ success: false });
    }
});

// 2. DinkaMovies Links ගන්න API එක
router.post('/api/dinkamovies/links', async (req, res) => {
    const { url } = req.body;
    try {
        const dlRes = await axios.get(`${DINKA_API}/dl?url=${encodeURIComponent(url)}`);
        
        if (dlRes.data?.status && dlRes.data.downloads) {
            const downloads = dlRes.data.downloads.map(dl => ({
                meta: dl.quality || 'Download',
                resolvedUrl: dl.direct_link || dl.link || dl.gdrive_link || '',
                direct: true,
                size: dl.size || ''
            })).filter(l => l.resolvedUrl); // ලින්ක් එකක් තියෙන ඒවා විතරක් ගන්නවා

            return res.json({ 
                success: true, 
                downloads, 
                thumbnail: dlRes.data.poster || '' 
            });
        }
        res.json({ success: false });
    } catch (error) {
        console.error("Dinka Links Error:", error.message);
        res.json({ success: false });
    }
});

module.exports = router;
