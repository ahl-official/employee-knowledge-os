import InterviewClient from "./InterviewClient";

export default async function InterviewPage({ params }: PageProps<"/interview/[token]">) {
  const { token } = await params;
  return <InterviewClient token={token} />;
}
