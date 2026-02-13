const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const ctx = preview.getContext("2d");
const status = document.getElementById("status");

let originalFileName = "icon";

fileInput.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;

    originalFileName = file.name.split(".")[0];

    const reader = new FileReader();
    reader.onload = function(evt){
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0,0,100,100);
            ctx.drawImage(img,0,0,100,100);
            status.textContent = "Image loaded ✔";
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
};

/* SMART EDGE REMOVE */
function smartEdgeRemove(canvas, tolerance, edgeProtect){
    const ctx = canvas.getContext("2d");
    const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    function getPixel(x,y){
        const i=(y*w+x)*4;
        return [data[i],data[i+1],data[i+2]];
    }

    const corners=[
        getPixel(0,0),
        getPixel(w-1,0),
        getPixel(0,h-1),
        getPixel(w-1,h-1)
    ];

    let avg=[0,0,0];
    corners.forEach(c=>{
        avg[0]+=c[0];
        avg[1]+=c[1];
        avg[2]+=c[2];
    });
    avg=avg.map(v=>v/4);

    for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
            const i=(y*w+x)*4;
            const r=data[i],g=data[i+1],b=data[i+2];

            const dist=Math.sqrt(
                (r-avg[0])**2+
                (g-avg[1])**2+
                (b-avg[2])**2
            );

            const dx=x-w/2;
            const dy=y-h/2;
            const centerDist=Math.sqrt(dx*dx+dy*dy);
            const maxDist=Math.sqrt((w/2)**2+(h/2)**2);
            const edgeFactor=centerDist/maxDist;

            if(dist<tolerance && edgeFactor>(edgeProtect/100)){
                data[i+3]=0;
            }
        }
    }

    ctx.putImageData(imgData,0,0);
    status.textContent="Background removed 🔥";
}

document.getElementById("removeBgBtn").onclick=()=>{
    const tol=parseInt(document.getElementById("tol").value);
    const edge=parseInt(document.getElementById("edge").value);
    smartEdgeRemove(preview,tol,edge);
};

/* ICO ENGINE */
function canvasToIco(sizes){
    const iconDir=[];
    const iconData=[];
    let offset=6+(16*sizes.length);

    sizes.forEach(size=>{
        const canvas=document.createElement("canvas");
        canvas.width=size;
        canvas.height=size;
        canvas.getContext("2d").drawImage(preview,0,0,size,size);

        const pngData=canvas.toDataURL("image/png");
        const byteString=atob(pngData.split(',')[1]);
        const array=new Uint8Array(byteString.length);
        for(let i=0;i<byteString.length;i++){
            array[i]=byteString.charCodeAt(i);
        }

        iconDir.push({
            width:size===256?0:size,
            height:size===256?0:size,
            size:array.length,
            offset:offset
        });

        iconData.push(array);
        offset+=array.length;
    });

    const buffer=new ArrayBuffer(offset);
    const view=new DataView(buffer);

    view.setUint16(0,0,true);
    view.setUint16(2,1,true);
    view.setUint16(4,sizes.length,true);

    let dirOffset=6;

    iconDir.forEach(dir=>{
        view.setUint8(dirOffset,dir.width);
        view.setUint8(dirOffset+1,dir.height);
        view.setUint8(dirOffset+2,0);
        view.setUint8(dirOffset+3,0);
        view.setUint16(dirOffset+4,1,true);
        view.setUint16(dirOffset+6,32,true);
        view.setUint32(dirOffset+8,dir.size,true);
        view.setUint32(dirOffset+12,dir.offset,true);
        dirOffset+=16;
    });

    let dataOffset=6+(16*sizes.length);
    iconData.forEach(arr=>{
        new Uint8Array(buffer,dataOffset,arr.length).set(arr);
        dataOffset+=arr.length;
    });

    return new Blob([buffer],{type:"image/x-icon"});
}

/* DOWNLOAD */
document.getElementById("downloadBtn").onclick = async () => {

    const format = document.getElementById("format").value;
    const size = parseInt(document.getElementById("sizeSelect").value);

    /* PNG */
    if(format === "png"){
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(preview,0,0,size,size);

        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = originalFileName + ".png";
        link.click();
        status.textContent = "PNG generated ✔";
    }

    /* ICO SINGLE */
    else if(format === "ico-single"){
        const blob = canvasToIco([size]);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = originalFileName + ".ico";
        link.click();
        status.textContent = "ICO generated ✔";
    }

    /* ICO MULTI */
    else if(format === "ico-multi"){
        const blob = canvasToIco([16,32,48,64,128,256]);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = originalFileName + ".ico";
        link.click();
        status.textContent = "Multi ICO generated ✔";
    }

    /* FAVICON PACK */
    else if(format === "favicon"){

        const zip = new JSZip();

        function createPNG(size, name){
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            canvas.getContext("2d").drawImage(preview,0,0,size,size);
            const data = canvas.toDataURL("image/png").split(',')[1];
            zip.file(name, data, {base64:true});
        }

        /* PNG Files */
        createPNG(16, "favicon-16x16.png");
        createPNG(32, "favicon-32x32.png");
        createPNG(192, "android-chrome-192x192.png");
        createPNG(512, "android-chrome-512x512.png");
        createPNG(180, "apple-touch-icon.png");

        /* ICO */
        const icoBlob = canvasToIco([16,32,48]);
        zip.file("favicon.ico", icoBlob);

        /* site.webmanifest */
        const manifestContent = `
{
  "name": "${originalFileName}",
  "short_name": "${originalFileName}",
  "icons": [
    {
      "src": "android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#111111",
  "background_color": "#111111",
  "display": "standalone"
}
        `;

        zip.file("site.webmanifest", manifestContent);

        const content = await zip.generateAsync({type:"blob"});

        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = originalFileName + "-favicon-pack.zip";
        link.click();

        status.textContent = "Favicon pack generated 🔥";
    }
};

