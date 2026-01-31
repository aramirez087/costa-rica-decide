export interface Candidate {
  id: string;
  name: string;
  imageUrl: string;
}

export interface PollResult {
  candidateId: string;
  votes: number;
}

export interface PollData {
  results: PollResult[];
  totalVotes: number;
}
