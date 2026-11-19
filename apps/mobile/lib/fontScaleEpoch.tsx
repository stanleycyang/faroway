import { useRef } from 'react';
import { Text, useWindowDimensions, type TextProps } from 'react-native';

/** Cold start keeps the measurement taken at the current scale. A font-scale
 * change while the process is alive returns a new key so Android recreates the
 * native text instead of painting larger glyphs into the old bounds. */
export function useFontScaleEpoch() {
  const { fontScale } = useWindowDimensions();
  const initial = useRef(fontScale);
  return fontScale === initial.current ? 'cold' : `font-scale-${fontScale}`;
}

export function FontScaleText({ children, ...props }: TextProps) {
  const epoch = useFontScaleEpoch();
  return (
    <Text {...props} key={epoch}>
      {children}
    </Text>
  );
}
