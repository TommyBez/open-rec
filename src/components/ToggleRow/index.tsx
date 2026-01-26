import { Camera, Mic, Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ToggleRowProps {
  icon: "camera" | "microphone" | "speaker";
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

const iconComponents = {
  camera: Camera,
  microphone: Mic,
  speaker: Volume2,
};

export function ToggleRow({ icon, label, enabled, onToggle }: ToggleRowProps) {
  const Icon = iconComponents[icon];

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
        "hover:bg-accent/50",
        enabled
          ? "border-primary bg-primary/5"
          : "border-border bg-card"
      )}
      onClick={onToggle}
    >
      <Icon
        className={cn(
          "size-5",
          enabled ? "text-primary" : "text-muted-foreground"
        )}
      />
      <Label className="flex-1 cursor-pointer text-sm font-medium">
        {label}
      </Label>
      <Badge
        variant={enabled ? "default" : "secondary"}
        className={cn(
          "text-xs",
          enabled
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/10"
            : "bg-destructive/10 text-destructive hover:bg-destructive/10"
        )}
      >
        {enabled ? "On" : "Off"}
      </Badge>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        size="sm"
      />
    </div>
  );
}
