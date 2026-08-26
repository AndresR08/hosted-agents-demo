import {
  createLightTheme,
  createDarkTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

/**
 * Brand ramp derived from the single accent token (#0F6CBD, tokens.ts).
 * Hand-authored approximation of a Fluent brand ramp — good enough to build
 * against now. Before this app is presented to a customer, regenerate the
 * ramp from the Fluent UI Theme Designer against the same accent colour.
 */
const gatewayBrand: BrandVariants = {
  10: "#001322",
  20: "#001B33",
  30: "#002444",
  40: "#002E58",
  50: "#00396C",
  60: "#004380",
  70: "#0B4E93",
  80: "#0F6CBD",
  90: "#2E7FCB",
  100: "#4A93D4",
  110: "#66A7DD",
  120: "#85BAE4",
  130: "#A4CDEC",
  140: "#C2DFF3",
  150: "#E0F0FA",
  160: "#F5FAFE",
};

export const gatewayLightTheme: Theme = createLightTheme(gatewayBrand);
export const gatewayDarkTheme: Theme = createDarkTheme(gatewayBrand);
