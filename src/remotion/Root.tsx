import { Composition } from "remotion";
import { DemoStills, DemoVideo } from "./DemoVideo";

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="DemoVideo"
				component={DemoVideo}
				durationInFrames={30 * 70}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="DemoStills"
				component={DemoStills}
				durationInFrames={30 * 70}
				fps={30}
				width={1920}
				height={1080}
			/>
		</>
	);
};
