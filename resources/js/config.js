// frontend/resources/js/config.js

// Detect development mode (running on Python http.server on port 3000)
const isDev = window.location.port === '3000';

window.CONFIG = {
    // In dev mode, call backend directly on port 8000
    // In production, use relative path (handled by nginx proxy)
    API_URL: isDev ? 'http://localhost:8000/api' : '/api',
    institutions: [
        {
            name: "Institut Imagine",
            logo: "II_60px.webp",
            url: "https://www.institutimagine.org/en",
            height: "60px",
            width: "157px",
            alt: "Institut Imagine Paris"
        },
        {
            name: "Univerité Paris Cité",
            logo: "UPC_60px.webp",
            url: "https://u-paris.fr/",
            height: "60px",
            width: "128px",
            alt: "Université Paris Cité"
        },
        {
            name: "Berlin Institute of Health at Charité (BIH)",
            logo: "BIH_60px.webp",
            url: "https://www.bihealth.org/en/",
            height: "60px",
            width: "136px",
            alt: "Berlin Institute of Health at Charité (BIH)"
        },
        {
            name: "Labor Berlin",
            logo: "LB_60px.webp",
            url: "https://www.laborberlin.com/en/",
            height: "60px",
            width: "234px",
            alt: "Labor Berlin"
        },
        {
            name: "CeRKiD",
            logo: "CeRKiD_60px.webp",
            url: "https://nephrologie-intensivmedizin.charite.de/en/fuer_patienten/cerkid/",
            height: "60px",
            width: "81px",
            alt: "CeRKiD"
        },
        {
            name: "ADTKD-Net",
            logo: "ADTKD-Net_horizontal_60px.webp",
            url: "https://www.gesundheitsforschung-bmbf.de/de/adtkd-net-netzwerk-fur-autosomal-dominante-tubulointerstitielle-nierenerkrankung-17889.php",
            height: "60px",
            width: "57px",
            alt: "ADTKD-Net"
        },
        {
            name: "ADTKD.de",
            logo: "adtkd_de_60px.webp",
            url: "https://www.adtkd.de",
            height: "60px",
            width: "124px",
            alt: "ADTKD.de"
        }
    ]
};
