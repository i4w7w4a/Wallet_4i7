"use client";

import { useEffect, useRef, useState } from "react";

import "./hero-video.css";

const POSTER_SOURCE = "/media/liquid-hero-poster.avif";

export function HeroVideo(props: {
  active: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  className?: string;
}) {
  const { active, reducedMotion, saveData, className } = props;

  if (reducedMotion || saveData) {
    return <HeroFrame className={className} loaded={false} />;
  }

  return <PlayableHero active={active} className={className} />;
}

function PlayableHero(props: { active: boolean; className?: string }) {
  const { active, className } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) {
      return;
    }

    if (!active) {
      video.pause();
      return;
    }

    const playback = video.play();
    if (playback) {
      void playback.catch(() => {
        setLoaded(false);
        setFailed(true);
      });
    }
  }, [active, failed]);

  return (
    <HeroFrame className={className} loaded={loaded && !failed}>
      {failed ? null : (
        <video
          ref={videoRef}
          className="hero-video__media"
          muted
          autoPlay={active}
          loop
          playsInline
          preload="metadata"
          poster={POSTER_SOURCE}
          aria-hidden="true"
          onLoadedData={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed(true);
          }}
        >
          <source src="/media/liquid-hero.webm" type="video/webm" />
          <source src="/media/liquid-hero.mp4" type="video/mp4" />
        </video>
      )}
    </HeroFrame>
  );
}

function HeroFrame(props: {
  className?: string;
  loaded: boolean;
  children?: React.ReactNode;
}) {
  const { className, loaded, children } = props;

  return (
    <div
      className={["hero-video", className].filter(Boolean).join(" ")}
      data-video-loaded={loaded ? "true" : "false"}
    >
      {children}
      <div
        className="hero-video__poster"
        aria-hidden="true"
        style={{ backgroundImage: `url("${POSTER_SOURCE}")` }}
      />
    </div>
  );
}
