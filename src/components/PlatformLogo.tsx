import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';
import type { PlatformId } from '../constants/platforms';

interface Props {
  id: PlatformId;
  size?: number;
}

export default function PlatformLogo({ id, size = 32 }: Props) {
  switch (id) {
    case 'netflix':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Rect width="36" height="36" rx="7" fill="#E50914" />
          <Path
            d="M11,27 L11,9 L22,27 L22,9"
            stroke="white" strokeWidth="4.5"
            strokeLinecap="square" strokeLinejoin="miter"
            fill="none"
          />
        </Svg>
      );
    case 'disney':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Rect width="36" height="36" rx="7" fill="#0063e5" />
          <Path
            d="M7,8 L7,28 Q7,28 15,28 Q23,28 23,18 Q23,8 15,8 Z"
            stroke="white" strokeWidth="2.2" fill="none" strokeLinejoin="round"
          />
          <Path
            d="M27,9 L27,15 M24,12 L30,12"
            stroke="white" strokeWidth="2.2" strokeLinecap="round"
          />
        </Svg>
      );
    case 'hbo':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Rect width="36" height="36" rx="7" fill="#5822b4" />
          <Path
            d="M7,27 L7,9 L18,22 L29,9 L29,27"
            stroke="white" strokeWidth="2.8"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'prime':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Rect width="36" height="36" rx="7" fill="#00a8e1" />
          <Path
            d="M9,28 L9,8 M9,8 L17,8 Q24,8 24,14 Q24,20 17,20 L9,20"
            stroke="white" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M9,26 Q18,31 27,26"
            stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"
          />
          <Path
            d="M25,24 L27,26 L25,28"
            stroke="white" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Rect width="36" height="36" rx="7" fill="#1C1C1E" />
          <Path
            d="M7,10 L15,10 M11,10 L11,26"
            stroke="white" strokeWidth="2.4" strokeLinecap="round"
          />
          <Path
            d="M17,10 L21,26 L25,10"
            stroke="white" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M28,14 L28,20 M25,17 L31,17"
            stroke="white" strokeWidth="2.4" strokeLinecap="round"
          />
        </Svg>
      );
    default:
      return null;
  }
}
