/**
 * Legal knowledge base (RAG foundation)
 * --------------------------------------
 * A small, citable corpus of Indian legal provisions sourced from official
 * government texts (india.gov.in / indiacode.nic.in). Each document is a
 * self-contained "chunk" so it can later be embedded and stored in a vector
 * store (FAISS, pgvector, etc.) without changing the retrieval interface.
 *
 * `retrieveContext()` is the single retrieval entry point. Today it uses a
 * transparent lexical (TF-style keyword overlap) scorer so the prototype runs
 * with zero infrastructure. Swapping in a vector search later only requires
 * changing the body of this function.
 */

export type LegalDoc = {
  id: string;
  act: string;
  section: string;
  title: string;
  text: string;
  source: string;
  tags: string[];
};

export const LEGAL_CORPUS: LegalDoc[] = [
  {
    id: "cpa-2019-2-7",
    act: "Consumer Protection Act, 2019",
    section: "Section 2(7) & 2(47)",
    title: "Who is a consumer and what is an unfair trade practice",
    text: "A 'consumer' is any person who buys goods or hires services for consideration, including deferred payment, but not a person who obtains them for resale or commercial purpose. An 'unfair trade practice' includes false representation about quality, misleading advertising, refusal to withdraw defective goods, refusing to refund money, and not issuing a bill or receipt.",
    source: "https://consumeraffairs.nic.in/acts-and-rules/consumer-protection",
    tags: ["consumer", "refund", "defective", "product", "service", "shop", "online", "ecommerce", "warranty", "seller"],
  },
  {
    id: "cpa-2019-34-35",
    act: "Consumer Protection Act, 2019",
    section: "Sections 34, 35 & 69",
    title: "Where and when to file a consumer complaint",
    text: "A complaint can be filed before the District Consumer Disputes Redressal Commission where the value of goods or services paid does not exceed Rs. 50 lakh; the State Commission handles up to Rs. 2 crore and the National Commission above that. A complaint may be filed where the consumer resides or works for gain. The limitation period is two years from the date the cause of action arises. Complaints can be filed online on the e-Daakhil portal, and no lawyer is mandatory.",
    source: "https://edaakhil.nic.in/",
    tags: ["consumer", "complaint", "commission", "forum", "file", "limitation", "edaakhil", "refund", "compensation"],
  },
  {
    id: "cpa-2019-2-9",
    act: "Consumer Protection Act, 2019",
    section: "Section 2(9)",
    title: "The six consumer rights",
    text: "Consumer rights include: the right to be protected against hazardous goods and services; the right to be informed about quality, quantity, potency, purity, standard and price; the right to access a variety of goods at competitive prices; the right to be heard at appropriate forums; the right to seek redressal against unfair or restrictive trade practices; and the right to consumer awareness.",
    source: "https://consumeraffairs.nic.in/acts-and-rules/consumer-protection",
    tags: ["consumer", "rights", "informed", "redressal", "hazardous", "price", "quality"],
  },
  {
    id: "ipc-420",
    act: "Indian Penal Code, 1860",
    section: "Section 420 (now BNS Section 318)",
    title: "Cheating and dishonestly inducing delivery of property",
    text: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property, or to make, alter or destroy a valuable security, is punishable with imprisonment up to seven years and fine. From 1 July 2024 the IPC is replaced by the Bharatiya Nyaya Sanhita, 2023, where cheating is covered by Section 318.",
    source: "https://www.indiacode.nic.in/handle/123456789/2263",
    tags: ["cheating", "fraud", "scam", "420", "ipc", "money", "deceive", "online", "fake"],
  },
  {
    id: "ipc-406",
    act: "Indian Penal Code, 1860",
    section: "Section 406 (now BNS Section 316)",
    title: "Criminal breach of trust",
    text: "Whoever, being entrusted with property, dishonestly misappropriates it or converts it to their own use, commits criminal breach of trust, punishable with imprisonment up to three years, or fine, or both. Under the Bharatiya Nyaya Sanhita, 2023 this is Section 316.",
    source: "https://www.indiacode.nic.in/handle/123456789/2263",
    tags: ["trust", "misappropriate", "406", "ipc", "property", "entrusted", "deposit", "money"],
  },
  {
    id: "ipc-379",
    act: "Indian Penal Code, 1860",
    section: "Sections 378 & 379 (now BNS Section 303)",
    title: "Theft",
    text: "Theft is dishonestly taking movable property out of another person's possession without consent. Punishment under Section 379 is imprisonment up to three years, or fine, or both. Under the Bharatiya Nyaya Sanhita, 2023 theft is Section 303. The victim should report it at the nearest police station and obtain an FIR copy.",
    source: "https://www.indiacode.nic.in/handle/123456789/2263",
    tags: ["theft", "stolen", "steal", "mobile", "phone", "bike", "379", "ipc", "police", "fir"],
  },
  {
    id: "ipc-498a",
    act: "Indian Penal Code, 1860",
    section: "Section 498A (now BNS Sections 85 & 86)",
    title: "Cruelty by husband or relatives",
    text: "A husband or his relative who subjects a woman to cruelty, including harassment for dowry or conduct likely to drive her to harm herself, is punishable with imprisonment up to three years and fine. Under the Bharatiya Nyaya Sanhita, 2023 this is covered by Sections 85 and 86. Women's helpline 181 provides support.",
    source: "https://www.indiacode.nic.in/handle/123456789/2263",
    tags: ["cruelty", "dowry", "husband", "wife", "harassment", "498a", "ipc", "marriage", "in-laws"],
  },
  {
    id: "ipc-506",
    act: "Indian Penal Code, 1860",
    section: "Sections 503 & 506 (now BNS Section 351)",
    title: "Criminal intimidation (threats)",
    text: "Threatening a person with injury to their person, reputation or property, intending to cause alarm or force them to do something, is criminal intimidation, punishable with imprisonment up to two years, or fine, or both; up to seven years if the threat is to cause death or grievous hurt. Under the Bharatiya Nyaya Sanhita, 2023 this is Section 351.",
    source: "https://www.indiacode.nic.in/handle/123456789/2263",
    tags: ["threat", "threatening", "intimidation", "506", "ipc", "blackmail", "danger", "kill"],
  },
  {
    id: "rent-deposit",
    act: "Model Tenancy Act, 2021 & Transfer of Property Act, 1882",
    section: "Model Tenancy Act, Sections 11 & 13; TPA Section 108",
    title: "Security deposit and tenant rights",
    text: "Under the Model Tenancy Act, 2021 the security deposit for residential premises cannot exceed two months' rent (six months for non-residential). The landlord must refund the deposit at the time of vacating, after adjusting lawful dues such as unpaid rent or damage beyond normal wear and tear. Disputes are decided by the Rent Authority / Rent Court, which is required to dispose of the matter within 60 days. Where the State has not adopted the Model Act, the tenancy agreement and the State Rent Control Act apply, and a civil suit for recovery of money lies. A written legal notice demanding refund is the usual first step.",
    source: "https://mohua.gov.in/upload/whatsnew/60c8f19aa477bModel-Tenancy-Act-English-23032021.pdf",
    tags: ["tenant", "landlord", "rent", "deposit", "security", "house", "flat", "vacate", "eviction", "lease", "agreement"],
  },
  {
    id: "bns-316",
    act: "Bharatiya Nyaya Sanhita, 2023 (replacing IPC Section 420)",
    section: "Section 316 (Criminal breach of trust) & Section 318 (Cheating)",
    title: "Cheating and criminal breach of trust",
    text: "Cheating means deceiving a person and dishonestly inducing them to deliver property or to do something they would not otherwise do. Cheating and dishonestly inducing delivery of property is punishable with imprisonment up to seven years and a fine. Criminal breach of trust, where property entrusted to a person is dishonestly misappropriated, is punishable with imprisonment up to five years and a fine. These are cognizable offences; an FIR can be registered at the police station having jurisdiction.",
    source: "https://www.indiacode.nic.in/handle/123456789/20062",
    tags: ["cheating", "fraud", "scam", "money", "fir", "police", "criminal", "breach", "trust", "duped"],
  },
  {
    id: "bnss-173",
    act: "Bharatiya Nagarik Suraksha Sanhita, 2023 (replacing CrPC Section 154)",
    section: "Sections 173 & 175",
    title: "Right to register an FIR (including Zero FIR and e-FIR)",
    text: "Information about a cognizable offence must be recorded by the officer in charge of a police station, read over to the informant, signed, and a free copy given to the informant. Information may be given electronically (e-FIR) and may be registered irrespective of the area where the offence was committed (Zero FIR). If the police refuse to register the FIR, the informant may send the information in writing by post to the Superintendent of Police, or approach the Magistrate under Section 175(3) to direct an investigation.",
    source: "https://www.indiacode.nic.in/handle/123456789/20099",
    tags: ["fir", "police", "complaint", "refuse", "zero fir", "magistrate", "sp", "crime", "report"],
  },
  {
    id: "wages-2019",
    act: "Code on Wages, 2019 & Payment of Wages Act, 1936",
    section: "Sections 17 & 45 of the Code on Wages",
    title: "Non-payment or delay of salary",
    text: "Wages must be paid before the expiry of the seventh day after the last day of the wage period for establishments with less than one thousand workers, and the tenth day otherwise. Where employment is terminated, wages must be paid within two working days. A claim for unpaid or delayed wages can be filed before the authority notified under the Code (usually the Labour Commissioner) within three years, and compensation up to ten times the claim amount may be awarded.",
    source: "https://labour.gov.in/sites/default/files/THE%20CODE%20ON%20WAGES%2C%202019%20No.%2029%20of%202019.pdf",
    tags: ["salary", "wages", "employer", "job", "labour", "unpaid", "employment", "termination", "work", "company"],
  },
  {
    id: "dv-2005",
    act: "Protection of Women from Domestic Violence Act, 2005",
    section: "Sections 12, 18-22",
    title: "Protection orders in domestic violence matters",
    text: "An aggrieved woman, a Protection Officer, or any person on her behalf may file an application before the Magistrate. The Magistrate may pass protection orders restraining further violence, residence orders securing the right to reside in the shared household, monetary relief for expenses and losses, custody orders, and compensation. The application is required to be disposed of within sixty days. Help is available on the women's helpline 181 and through District Protection Officers.",
    source: "https://wcd.gov.in/act/protection-women-domestic-violence-act-2005",
    tags: ["domestic", "violence", "women", "wife", "husband", "abuse", "protection", "harassment", "family", "household"],
  },
  {
    id: "rti-2005",
    act: "Right to Information Act, 2005",
    section: "Sections 6, 7 & 19",
    title: "Filing an RTI application",
    text: "Any citizen may request information from a public authority by applying in writing or electronically to the Public Information Officer with a fee of Rs. 10. The information must be provided within thirty days, or within forty-eight hours where it concerns the life or liberty of a person. If information is refused or not supplied in time, a first appeal lies to the senior officer within thirty days, and a second appeal to the Information Commission within ninety days.",
    source: "https://rtionline.gov.in/",
    tags: ["rti", "information", "government", "department", "officer", "appeal", "public", "delay"],
  },
  {
    id: "legal-aid",
    act: "Legal Services Authorities Act, 1987",
    section: "Sections 12 & 19",
    title: "Free legal aid and Lok Adalat",
    text: "Free legal services, including representation by a lawyer, are available to women, children, Scheduled Caste and Scheduled Tribe members, victims of trafficking or disaster, persons with disabilities, persons in custody, and any person whose annual income is below the limit prescribed by the State. Applications are made to the District Legal Services Authority (DLSA) at the district court complex, or through the NALSA helpline 15100. Lok Adalats settle disputes amicably and their award is final and binding with no court fee.",
    source: "https://nalsa.gov.in/",
    tags: ["legal aid", "free", "lawyer", "poor", "nalsa", "dlsa", "lok adalat", "help", "court fee"],
  },
  {
    id: "cheque-138",
    act: "Negotiable Instruments Act, 1881",
    section: "Section 138",
    title: "Dishonour of cheque",
    text: "Where a cheque is returned unpaid for insufficiency of funds or because it exceeds the arrangement, the payee must issue a written demand notice within thirty days of receiving the bank's return memo. If the drawer fails to pay within fifteen days of the notice, a complaint may be filed before the Magistrate within one month of the expiry of that period. Punishment may extend to two years' imprisonment or a fine up to twice the cheque amount, or both.",
    source: "https://www.indiacode.nic.in/handle/123456789/2263",
    tags: ["cheque", "bounce", "bank", "payment", "notice", "money", "recovery", "138"],
  },
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "have", "has", "was", "were", "are", "you", "your",
  "but", "not", "can", "what", "should", "how", "who", "from", "about", "there", "them", "they",
  "will", "would", "could", "into", "than", "then", "when", "does", "did", "get", "got", "any",
  "all", "our", "out", "his", "her", "him", "she", "its", "some", "been", "being", "which", "why",
  "i", "me", "my", "am", "is", "it", "a", "an", "of", "to", "in", "on", "do", "if", "so", "as", "at", "be", "by", "or", "we", "us", "no",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

export type RetrievedDoc = LegalDoc & { score: number };

/**
 * Retrieve the most relevant legal documents for a user query.
 * Replace the scoring body with a vector similarity search to move from
 * lexical retrieval to embedding-based retrieval — the signature stays stable.
 */
export function retrieveContext(query: string, topK = 4): RetrievedDoc[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = LEGAL_CORPUS.map((doc) => {
    const haystack = `${doc.title} ${doc.act} ${doc.text} ${doc.tags.join(" ")}`.toLowerCase();
    let score = 0;

    for (const token of queryTokens) {
      if (doc.tags.some((tag) => tag.includes(token) || token.includes(tag))) score += 3;
      if (haystack.includes(token)) score += 1;
    }

    return { ...doc, score };
  });

  return scored
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Format retrieved documents into a grounding block for the model prompt. */
export function buildContextBlock(docs: RetrievedDoc[]): string {
  if (docs.length === 0) return "No matching provision was found in the knowledge base.";

  return docs
    .map(
      (doc, index) =>
        `[${index + 1}] ${doc.act} — ${doc.section}\nTitle: ${doc.title}\nText: ${doc.text}\nOfficial source: ${doc.source}`,
    )
    .join("\n\n");
}
