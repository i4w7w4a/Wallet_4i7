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
          var theme="dark",background="iris";
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
          document.documentElement.dataset.monoPrepaintTheme=theme;
          document.documentElement.dataset.monoPrepaintBackground=background;
        })()` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
