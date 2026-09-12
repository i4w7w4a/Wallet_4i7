# Liquid hero-видео

## Источник

Оригинал передан под именем `2026-09-12T00-17-22_generation.mp4`. На машине
кодирования он был доступен как
`C:\Users\win11\Downloads\2026-09-12T00-17-22_generation.mp4` и сохранён в
репозитории как `assets/source/liquid-hero-source.mp4`. Файл в `Downloads` при
этом не изменялся.

- SHA-256: `9D0E6DB8BAC057C3F44EA500E5751EA33C4046E35FEDE80F5F04E62A062005A0`;
- контейнер и кодек: MP4, H.264 Main, `yuv420p`;
- геометрия: 1080×1440;
- частота: 24 FPS;
- длительность: 8,75 с;
- аудиопоток отсутствует;
- текст и логотипы не добавляются.

Только исходный MP4 хранится через Git LFS. Производные файлы находятся в
`apps/miniapp/public/media/` и доступны в обычном checkout.

## Обработка

Пайплайн оставляет основной фрагмент 0,60–8,15 с и добавляет шов длительностью
0,60 с: хвост 8,15–8,75 с плавно смешивается с головой 0–0,60 с. После этого
кадр центрирован до 1080×1350, уменьшен до 720×900 и приведён к 24 FPS.
Последний кадр перехода совпадает с началом следующего цикла.

Runtime-форматы:

- `liquid-hero.mp4`: H.264, `libx264`, начальный CRF 25, preset `slow`,
  `yuv420p`, faststart;
- `liquid-hero.webm`: VP9, `libvpx-vp9`, начальный CRF 34, constant quality,
  row multithreading;
- `liquid-hero-poster.avif`: AV1 still picture из кадра через 0,10 с после
  точки шва.

Если MP4 или WebM превышает 3 500 000 байт, скрипт повышает CRF на 2 и
повторяет кодирование. Для постера действует лимит 250 000 байт. Геометрия и
FPS при повторном кодировании не меняются.

## Воспроизведение

Требуются Node.js 24, `ffmpeg` с энкодерами `libx264`, `libvpx-vp9` и
`libaom-av1`, а также `ffprobe` в `PATH`.

```powershell
node --test scripts/media/encode-liquid-hero.test.mjs
node scripts/media/encode-liquid-hero.mjs
node scripts/media/encode-liquid-hero.mjs --verify-only
```

Нестандартные пути к бинарникам можно передать явно:

```powershell
node scripts/media/encode-liquid-hero.mjs `
  --ffmpeg C:\tools\ffmpeg\bin\ffmpeg.exe `
  --ffprobe C:\tools\ffmpeg\bin\ffprobe.exe
```

Для независимой проверки:

```powershell
ffprobe -v error -show_entries `
  format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate `
  -of json apps/miniapp/public/media/liquid-hero.mp4

ffprobe -v error -show_entries `
  format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate `
  -of json apps/miniapp/public/media/liquid-hero.webm
```

## Замена источника

Новая версия принимается только вместе с новым ожидаемым SHA-256 и
обновлёнными зафиксированными параметрами источника. Нужно заменить LFS-файл,
обновить константу и этот документ, запустить тест, полностью пересобрать три
производных файла и снова проверить кодеки, отсутствие аудио и размеры. Нельзя
коммитить производные файлы от источника с неподтверждённым хешем.
