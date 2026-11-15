"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { safeHref } from "../../safe-href";

export interface SliderProps {
  autoPlaySeconds?: number;
  height?: "compact" | "medium" | "tall";
  slide1Title?: string;
  slide1Subtitle?: string;
  slide1ImageUrl?: string;
  slide1ButtonText?: string;
  slide1ButtonHref?: string;
  slide2Title?: string;
  slide2Subtitle?: string;
  slide2ImageUrl?: string;
  slide2ButtonText?: string;
  slide2ButtonHref?: string;
  slide3Title?: string;
  slide3Subtitle?: string;
  slide3ImageUrl?: string;
  slide3ButtonText?: string;
  slide3ButtonHref?: string;
}

interface SlideItem {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonHref?: string;
}

export function SliderComponent(props: SliderProps) {
  const slides: SlideItem[] = [
    {
      title: props.slide1Title,
      subtitle: props.slide1Subtitle,
      imageUrl: props.slide1ImageUrl,
      buttonText: props.slide1ButtonText,
      buttonHref: props.slide1ButtonHref,
    },
    {
      title: props.slide2Title,
      subtitle: props.slide2Subtitle,
      imageUrl: props.slide2ImageUrl,
      buttonText: props.slide2ButtonText,
      buttonHref: props.slide2ButtonHref,
    },
    {
      title: props.slide3Title,
      subtitle: props.slide3Subtitle,
      imageUrl: props.slide3ImageUrl,
      buttonText: props.slide3ButtonText,
      buttonHref: props.slide3ButtonHref,
    },
  ].filter((s) => Boolean(s.title || s.subtitle || s.imageUrl));

  const [activeIndex, setActiveIndex] = useState(0);
  const autoPlaySeconds = typeof props.autoPlaySeconds === "number" ? props.autoPlaySeconds : 5;

  useEffect(() => {
    if (slides.length <= 1 || autoPlaySeconds <= 0) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, autoPlaySeconds * 1000);
    return () => clearInterval(timer);
  }, [slides.length, autoPlaySeconds]);

  if (slides.length === 0) {
    return null;
  }

  const safeIndex = activeIndex % slides.length;
  const heightClass = {
    compact: "min-h-[320px] md:min-h-[380px]",
    medium: "min-h-[400px] md:min-h-[480px]",
    tall: "min-h-[460px] md:min-h-[560px]",
  }[props.height || "medium"];

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Öne Çıkan Koleksiyonlar"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      <div
        className={`relative w-full ${heightClass} rounded-2xl overflow-hidden bg-stone-900 text-white shadow-xl`}
      >
        {slides.map((slide, idx) => {
          const isCurrent = idx === safeIndex;
          const imgSrc = slide.imageUrl ? safeHref(slide.imageUrl, "") : "";
          return (
            <div
              key={idx}
              aria-hidden={!isCurrent}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isCurrent ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {imgSrc && (
                <Image
                  src={imgSrc}
                  alt={slide.title || `Slayt ${idx + 1}`}
                  fill
                  unoptimized
                  priority={idx === 0}
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-stone-950/50 to-stone-950/20" />
              <div className="relative z-10 h-full flex flex-col justify-center px-8 sm:px-14 lg:px-20 max-w-2xl space-y-5">
                {slide.title && (
                  <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
                    {slide.title}
                  </h2>
                )}
                {slide.subtitle && (
                  <p className="text-stone-200 text-base sm:text-lg leading-relaxed">
                    {slide.subtitle}
                  </p>
                )}
                {slide.buttonText && (
                  <div className="pt-2">
                    <Link
                      href={safeHref(slide.buttonHref)}
                      tabIndex={isCurrent ? 0 : -1}
                      className="inline-flex items-center justify-center bg-white text-stone-900 font-semibold px-6 py-3 rounded-lg hover:bg-stone-100 transition shadow-sm text-sm"
                    >
                      {slide.buttonText}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Önceki slayt"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Sonraki slayt"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Slayt ${idx + 1}`}
                  aria-current={idx === safeIndex ? "true" : undefined}
                  className={`h-2.5 rounded-full transition-all ${
                    idx === safeIndex ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
