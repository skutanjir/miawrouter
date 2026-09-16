const ASSETS = {
  icon: {
    light: "/miawrouter-favicon-32.png",
    dark: "/miawrouter-favicon-48.png",
  },
  app: {
    light: "/miawrouter-app-light.png",
    dark: "/miawrouter-app-dark.png",
  },
  mascot: {
    light: "/miawrouter-mascot-router.png",
    dark: "/miawrouter-mascot-router.png",
  },
};

export default function BrandAsset({ kind = "icon", className = "", ...props }) {
  const asset = ASSETS[kind] || ASSETS.icon;
  return (
    <img
      {...props}
      src={asset.light}
      data-brand-asset={kind}
      alt={props.alt || ""}
      aria-hidden={props.alt ? undefined : true}
      className={className}
    />
  );
}
