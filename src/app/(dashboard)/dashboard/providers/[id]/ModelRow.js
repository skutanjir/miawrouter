import PropTypes from "prop-types";
import { Badge, CapacityBadges, ProviderIcon } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
export default function ModelRow({ model, providerId, fullModel, alias, copied, onCopy, testStatus, isCustom, isFree, onDeleteAlias, onTest, isTesting, onDisable, caps, thinkingSuffix }) {
  const displayModel = thinkingSuffix ? `${fullModel}(${thinkingSuffix})` : fullModel;
  const borderColor = testStatus === "ok"
    ? "border-success/40"
    : testStatus === "error"
    ? "border-danger/40"
    : "border-border-subtle";

  return (
    <div role="row" className={`group min-w-0 max-w-full border-b px-3 py-2 ${borderColor} hover:bg-surface-2/60`}>
      <div className="flex min-w-0 items-start gap-2 sm:items-center">
        <ProviderIcon
          providerId={providerId}
          size={18}
          fallbackIcon="smart_toy"
          className="shrink-0"
        />
        {testStatus && <Badge variant={testStatus === "ok" ? "success" : "error"} size="sm">{testStatus === "ok" ? "Available" : "Test failed"}</Badge>}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <code className="max-w-[72vw] truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-main sm:max-w-[360px]">{displayModel}</code>
          <span className="flex min-w-0 items-center gap-1 pl-1 text-[10px] text-text-muted">
            {model.name && <span className="truncate italic">{model.name}</span>}
            <CapacityBadges caps={caps} colorOverride="text-text-muted" size={12} />
          </span>
        </div>
        {onTest && (
          <div className="relative shrink-0 group/btn">
            <button
              onClick={onTest}
              disabled={isTesting}
              className={`rounded-md p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-primary ${isTesting ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}
            >
              <Icon name={isTesting ? "progress_activity" : "science"} className=" text-sm" style={isTesting ? { animation: "spin 1s linear infinite" } : undefined} />
            </button>
            <span className="pointer-events-none absolute mt-1 top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
              {isTesting ? "Testing..." : "Test"}
            </span>
          </div>
        )}
        <div className="relative shrink-0 group/btn">
          <button
            onClick={() => onCopy(displayModel, `model-${model.id}`)}
            className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-primary"
          >
            <Icon name={copied === `model-${model.id}` ? "check" : "content_copy"} className=" text-sm" />
          </button>
          <span className="pointer-events-none absolute mt-1 top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
            {copied === `model-${model.id}` ? "Copied!" : "Copy"}
          </span>
        </div>
        {isCustom ? (
          <button
            onClick={onDeleteAlias}
            className="ml-auto rounded-md p-1 text-text-muted opacity-100 transition-colors hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove custom model"
          >
            <Icon name={"close"} className=" text-sm" />
          </button>
        ) : onDisable ? (
          <button
            onClick={onDisable}
            className="ml-auto rounded-md p-1 text-text-muted opacity-100 transition-colors hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
            title="Disable this model"
          >
            <Icon name={"close"} className=" text-sm" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

ModelRow.propTypes = {
  model: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  providerId: PropTypes.string,
  fullModel: PropTypes.string.isRequired,
  alias: PropTypes.string,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  testStatus: PropTypes.oneOf(["ok", "error"]),
  isCustom: PropTypes.bool,
  isFree: PropTypes.bool,
  onDeleteAlias: PropTypes.func,
  onTest: PropTypes.func,
  isTesting: PropTypes.bool,
  onDisable: PropTypes.func,
  caps: PropTypes.object,
  thinkingSuffix: PropTypes.string,
};
