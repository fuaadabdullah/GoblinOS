import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StreamingView from "../components/StreamingView";

describe("StreamingView (server render)", () => {
	it("renders streaming text", () => {
		const html = renderToString(
			// @ts-ignore server render for test
			<StreamingView streamingText={"hello"} />,
		);
		expect(html).toContain("hello");
		expect(html).toContain("Streaming Output");
	});
});
