import { useId } from "react";

type AssetsWalletKind = "custodial" | "depositary" | "private";

type AssetsWalletArtProps = {
  kind: AssetsWalletKind;
  className?: string;
};

/** Original vector interpretation of the AT01R account-type concepts. */
export function AssetsWalletArt({ kind, className }: AssetsWalletArtProps) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <svg className={className} viewBox="18 10 205 182" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#777b8d" />
          <stop offset="0.22" stopColor="#343746" />
          <stop offset="0.65" stopColor="#181b27" />
          <stop offset="1" stopColor="#0b0d16" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d9d6df" />
          <stop offset="0.3" stopColor="#777b91" />
          <stop offset="0.68" stopColor="#3a3a50" />
          <stop offset="1" stopColor="#9882f3" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0.8">
          <stop stopColor="#555a6d" />
          <stop offset="0.32" stopColor="#171a26" />
          <stop offset="0.75" stopColor="#090b12" />
          <stop offset="1" stopColor="#6350b0" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0.1" y1="0" x2="0.85" y2="1">
          <stop stopColor="#9596a1" />
          <stop offset="0.22" stopColor="#626572" />
          <stop offset="0.58" stopColor="#373a49" />
          <stop offset="1" stopColor="#191b29" />
        </linearGradient>
        <linearGradient id={`${id}-violet`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b4a7ff" />
          <stop offset="0.35" stopColor="#7456ee" />
          <stop offset="1" stopColor="#2e1c75" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#7656f1" stopOpacity="0.48" />
          <stop offset="0.48" stopColor="#694be1" stopOpacity="0.16" />
          <stop offset="1" stopColor="#694be1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-warm`} cx="0.12" cy="0.08" r="0.95">
          <stop stopColor="#d6a58c" stopOpacity="0.28" />
          <stop offset="1" stopColor="#d6a58c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="145" cy="165" rx="83" ry="27" fill={paint("glow")} />

      {kind === "custodial" && <g strokeLinejoin="round">
        {/* Each sheet has a separate edge and face, so the stack reads at large sizes. */}
        <path d="M91 27 Q91 18 101 21 L185 54 Q195 58 195 68 L195 147 Q195 155 187 158 L177 161 L177 68 L91 35 Z" fill={paint("violet")} stroke={paint("edge")} strokeWidth="1.2" />
        <path d="M91 28 Q91 21 99 24 L180 56 Q188 59 188 68 L188 151 Q188 158 181 156 L100 123 Q91 120 91 111 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M80 41 Q80 33 89 36 L173 69 Q183 73 183 82 L183 158 Q183 166 174 168 L165 169 L165 82 L80 48 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M80 42 Q80 35 88 38 L169 70 Q177 73 177 82 L177 161 Q177 169 169 166 L88 134 Q80 131 80 122 Z" fill={paint("face")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M68 55 Q68 47 77 50 L160 82 Q170 86 170 95 L170 168 Q170 176 162 178 L153 179 L153 95 L68 62 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M68 56 Q68 49 76 52 L157 84 Q165 87 165 96 L165 171 Q165 179 157 176 L76 145 Q68 142 68 133 Z" fill={paint("face")} stroke={paint("edge")} strokeWidth="1.2" />
        <path d="M56 68 Q56 60 65 63 L148 95 Q158 99 158 108 L158 177 Q158 185 150 187 L141 188 L141 108 L56 75 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M56 69 Q56 62 64 65 L145 97 Q153 100 153 109 L153 179 Q153 187 145 184 L64 153 Q56 150 56 141 Z" fill={paint("face")} stroke={paint("edge")} strokeWidth="1.2" />
        <path d="M56 69 Q56 62 64 65 L145 97 Q153 100 153 109 L153 179 Q153 187 145 184 L64 153 Q56 150 56 141 Z" fill={paint("warm")} />
        <path d="M58 72 Q58 65 65 68 L105 83" fill="none" stroke="#e4b69d" strokeOpacity="0.24" strokeWidth="3" strokeLinecap="round" />
        <path d="M61 69 L144 101 Q149 103 149 110" fill="none" stroke="#e1deed" strokeOpacity="0.48" strokeWidth="0.8" />
      </g>}

      {kind === "depositary" && <g strokeLinejoin="round">
        {/* Three machined slabs: their separated seams catch the same violet light. */}
        <path d="M43 133 L116 100 Q124 96 133 100 L196 126 L196 150 Q196 156 189 160 L132 187 Q125 190 117 187 L49 160 Q43 157 43 151 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M43 133 L115 101 Q124 97 133 101 L194 126 Q199 128 193 132 L132 161 Q125 164 117 161 L47 137 Q40 135 43 133 Z" fill={paint("top")} stroke={paint("edge")} strokeWidth="1.2" />
        <path d="M49 111 L116 80 Q124 76 133 80 L192 104 L192 127 Q192 133 185 137 L131 162 Q124 165 117 162 L54 139 Q48 137 49 131 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M49 111 L116 80 Q124 76 133 80 L190 104 Q196 106 190 110 L131 137 Q124 140 117 137 L53 115 Q46 113 49 111 Z" fill={paint("top")} stroke={paint("edge")} strokeWidth="1.2" />
        <path d="M54 88 L116 59 Q124 55 133 59 L186 81 L186 105 Q186 111 180 114 L131 137 Q124 140 117 137 L59 116 Q53 114 54 108 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M55 85 L115 56 Q124 52 133 56 L185 77 Q192 80 185 84 L131 110 Q124 113 116 110 L57 90 Q50 88 55 85 Z" fill={paint("top")} stroke={paint("edge")} strokeWidth="1.3" />
        <path d="M185 86 L185 104 Q185 110 180 112" fill="none" stroke="#d5d8e4" strokeOpacity="0.58" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M58 89 L116 109 Q124 112 131 109 L183 84" fill="none" stroke="#f1eef5" strokeOpacity="0.3" strokeWidth="0.8" />
        <path d="M54 116 L117 138 Q124 141 131 138 L180 115" fill="none" stroke="#856aff" strokeOpacity="0.75" strokeWidth="1.5" />
        <path d="M49 137 L117 162 Q124 165 131 162" fill="none" stroke="#866cf3" strokeOpacity="0.38" strokeWidth="1" />
      </g>}

      {kind === "private" && <g strokeLinejoin="round">
        {/* A continuous folded shell with a visible inner cavity and return lip. */}
        <path d="M54 66 L105 40 Q110 38 116 40 L177 63 Q191 68 192 79 L185 141 Q184 150 176 155 L143 174 Q137 178 129 175 L67 150 Q59 147 58 138 L49 76 Q48 69 54 66 Z" fill={paint("side")} stroke={paint("edge")} strokeWidth="1.3" />
        <path d="M108 46 L169 69 Q180 73 179 84 L170 133 Q168 143 160 147 L137 158 L126 103 Q124 93 115 89 L55 67 Z" fill="#10121d" stroke="#9b98ad" strokeOpacity="0.75" strokeWidth="1" />
        <path d="M172 74 Q190 68 190 84 L182 134 Q181 142 174 145 L152 154 Q162 145 165 132 L176 91 Q179 80 172 74 Z" fill={paint("violet")} opacity="0.68" />
        <path d="M55 66 L107 40 Q112 38 118 40 L177 63 Q185 66 189 73 Q181 68 175 71 L124 96 Q119 92 112 89 L53 69 Z" fill={paint("top")} stroke={paint("edge")} strokeWidth="1.2" />
        <path d="M53 69 L112 91 Q123 95 125 106 L136 161 Q137 168 144 169 L131 175 Q128 176 123 174 L67 151 Q59 148 58 139 L49 77 Q48 71 53 69 Z" fill={paint("face")} stroke={paint("edge")} strokeWidth="1.3" />
        <path d="M136 160 Q138 170 145 168 L180 151 Q189 147 193 151 Q196 154 190 158 L145 180 Q139 183 132 179 L127 176 Q137 178 142 174 Z" fill={paint("violet")} stroke={paint("edge")} strokeWidth="1.1" />
        <path d="M54 70 L111 92 Q121 96 123 106 L134 161 Q136 169 143 169" fill="none" stroke="#e4e2ef" strokeOpacity="0.65" strokeWidth="1.15" />
        <path d="M144 170 L187 151" fill="none" stroke="#c8baff" strokeOpacity="0.65" strokeWidth="0.8" />
      </g>}
    </svg>
  );
}
