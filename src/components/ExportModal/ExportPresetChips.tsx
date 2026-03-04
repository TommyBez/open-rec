import type { Dispatch, SetStateAction } from "react";
import type { ExportOptions as ExportOptionsType } from "../../types/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { getPresetOptions } from "./exportModalUtils";

interface ExportPresetChipsProps {
  activePreset: "youtube-4k" | "web-discord" | "prores-master" | "custom";
  setOptions: Dispatch<SetStateAction<ExportOptionsType>>;
}

export function ExportPresetChips({ activePreset, setOptions }: ExportPresetChipsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <Label className="text-muted-foreground text-xs">Preset</Label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activePreset === "youtube-4k" ? "default" : "outline"}
          size="sm"
          onClick={() => setOptions(getPresetOptions("youtube-4k"))}
        >
          YouTube 4K
        </Button>
        <Button
          variant={activePreset === "web-discord" ? "default" : "outline"}
          size="sm"
          onClick={() => setOptions(getPresetOptions("web-discord"))}
        >
          Web (Discord/Slack)
        </Button>
        <Button
          variant={activePreset === "prores-master" ? "default" : "outline"}
          size="sm"
          onClick={() => setOptions(getPresetOptions("prores-master"))}
        >
          ProRes Master
        </Button>
        {activePreset === "custom" && (
          <Badge variant="secondary" className="px-2.5 py-1 text-[10px] uppercase tracking-wider">
            Custom
          </Badge>
        )}
      </div>
    </div>
  );
}
