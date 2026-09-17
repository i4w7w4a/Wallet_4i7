import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Wallet_4i7",
  description: "Мобильный шаблон кошелька",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* This route-scoped prepaint script keeps /mono's local preview visible before hydration.
            A future strict CSP must grant this inline script a nonce. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){
          if(location.pathname!=="/mono")return;
          var theme="dark",background="iris",root=document.documentElement;
          try{
            var raw=localStorage.getItem("wallet4i7.mono.environment-preview.v1");
            if(raw&&raw.length<=500){
              var saved=JSON.parse(raw);
              if(saved&&saved.version===1){
                if(saved.theme==="light")theme="light";
                if(saved.background==="tide"||saved.background==="strata")background=saved.background;
              }
            }
          }catch(e){}
          try{
            var paletteRaw=localStorage.getItem("wallet4i7.mono.palette-prepaint.v1");
            if(paletteRaw&&paletteRaw.length<=50000){
              var palette=JSON.parse(paletteRaw);
              if(palette&&palette.version===1&&(palette.mode==="dark"||palette.mode==="light")&&
                 (palette.slotId===1||palette.slotId===2||palette.slotId===3)&&
                 typeof palette.paletteEnabled==="boolean"){
                theme=palette.mode;
                root.dataset.monoPrepaintPalette=String(palette.paletteEnabled);
                root.dataset.monoPrepaintPreset=["ledger","frost","mercury"][palette.slotId-1];
                if(palette.paletteEnabled&&palette.tokens&&typeof palette.tokens==="object"&&!Array.isArray(palette.tokens)){
                  var names=Object.keys(palette.tokens);
                  if(names.length<=250)for(var i=0;i<names.length;i++){
                    var name=names[i],value=palette.tokens[name];
                    if(/^--mono-palette-[A-Za-z]+-[0-9a-f]{2}$/.test(name)&&Array.isArray(value)&&value.length===4&&
                       value.every(function(n){return typeof n==="number"&&Number.isFinite(n)})&&
                       value[0]>=0&&value[0]<=255&&value[1]>=0&&value[1]<=255&&
                       value[2]>=0&&value[2]<=255&&value[3]>=0&&value[3]<=1)
                      root.style.setProperty(name,"rgb("+value[0]+" "+value[1]+" "+value[2]+" / "+value[3]+")");
                  }
                }
              }
            }
          }catch(e){}
          root.dataset.monoPrepaintTheme=theme;
          root.dataset.monoPrepaintBackground=background;
        })()` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
