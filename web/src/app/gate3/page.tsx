import { ContentPackQaScreen } from "@/components/gate3/ContentPackQaScreen";
import { gate3RealContentPack } from "@/data/realMatch/gate3ContentPack";

export default function Gate3Page() {
  return <ContentPackQaScreen pack={gate3RealContentPack} />;
}
