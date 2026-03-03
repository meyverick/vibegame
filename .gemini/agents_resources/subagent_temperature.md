# **The Thermostat of Intelligence: A Definitive Guide to Configuring Temperature for Gemini CLI Sub-Agents**

## **Executive Summary**

The configuration of Large Language Models (LLMs) has historically been governed by a relatively stable set of hyperparameters—Temperature, Top-P, and Top-K—that allowed engineers to navigate the trade-off between deterministic precision and creative diversity. However, the release of the Gemini 3 model family has fundamentally disrupted this paradigm. Where previous generations (Gemini 1.0, 1.5) adhered to the classical "low temperature for logic, high temperature for creativity" heuristic, Gemini 3 introduces a reasoning-heavy architecture that destabilizes at low temperatures, necessitating a complete re-evaluation of sub-agent configuration strategies.

This report provides an exhaustive technical analysis of sampling dynamics within the Gemini ecosystem. It serves as an implementation manual for systems architects designing multi-agent CLI systems. We explore the mathematical underpinnings of Softmax sampling, the emergence of "Looping" artifacts in reasoning models, and the specific application of the new thinking_level parameter. Furthermore, we provide a definitive Heuristic Lookup Table for four primary sub-agent archetypes—Orchestrator, Coder, Creative Writer, and Data Analyst—tailored specifically for the distinct behaviors of Gemini 1.5 Flash/Pro and Gemini 3 Flash/Pro.

## **Part I: The Physics of Token Generation**

To master the configuration of Gemini sub-agents, one must first master the mathematical engine of generation: the sampling strategy. The parameters exposed in the Gemini CLI—temperature, topP, and topK—are not arbitrary knobs but variables in the probability distribution function that determines the next token in a sequence. Understanding these mechanisms at a granular level is a prerequisite for engineering robust agentic behaviors.

### **1.1 The Softmax Function and Logit Space**

At the core of every Gemini model is the prediction of the next token ![][image1] given a sequence of context tokens ![][image2]. The model's final hidden layer produces a vector of logits ![][image3], where ![][image4] is the vocabulary size (approximately 256,000 for Gemini models). These logits represent the raw, unnormalized confidence scores for each potential next token.1 Logits exist in purely numerical space, ranging from negative infinity to positive infinity, and do not inherently represent probabilities until transformed.

To convert these logits into a probability distribution ![][image5], the Softmax function is applied. This function normalizes the vector such that all components sum to 1.0, allowing for probabilistic sampling. The Temperature parameter (![][image6]) is introduced as a scaling factor in the denominator of the exponent. Mathematically, the probability ![][image7] of selecting the ![][image8]\-th token in the vocabulary is given by:

![][image9]  
This equation reveals the non-linear relationship between the model's internal confidence (logits) and the external sampling behavior (probabilities). The temperature ![][image6] acts as a "contrast knob" for the probability distribution.1

#### **1.1.1 The Mathematical Impact of ![][image10] (Sharpening)**

When ![][image11], the term ![][image12] amplifies the differences between logits. If token A has a logit of 5.0 and token B has a logit of 4.0:

- At ![][image13]: ![][image14] and ![][image15]. The ratio is roughly 2.7:1.
- At ![][image16]: ![][image17] and ![][image18]. The ratio becomes astronomical (![][image19]).

This effectively "sharpens" the distribution, pushing the probability of the most likely token toward 1.0 and all others toward 0.0.1 In classical LLM engineering (Gemini 1.5 and earlier), this was the gold standard for coding and mathematical tasks. By setting ![][image20] (Greedy Decoding), engineers forced the model to strictly adhere to the most probable path, minimizing the chance of diverging into incorrect syntax or logic.3 This created a deterministic output stream where the same input always yielded the same output, a critical requirement for regression testing in software engineering workflows.

#### **1.1.2 The Mathematical Impact of ![][image21] (Flattening)**

Conversely, when ![][image21], the distribution flattens. The gap between the best token and the mediocre tokens shrinks, allowing the sampling algorithm to select less probable words. This introduces "entropy" or "creativity" into the system.2 For a Creative Writer agent, this is desirable; it allows the model to bypass the cliché (most probable) word choice and select a more novel, albeit linguistically valid, alternative. However, for a Code Architect, this is catastrophic, as "novelty" in syntax usually equates to a syntax error.

### **1.2 The Interaction Landscape: Temperature, Nucleus, and Top-K**

Temperature does not act in isolation. It functions as a modifier to the probability landscape _before_ the truncation strategies of Top-P and Top-K are applied. This interaction is often misunderstood, leading to suboptimal configurations where engineers attempt to use Top-P to fix issues caused by Temperature.

#### **1.2.1 Top-K Sampling: The Hard Cutoff**

Top-K is a hard truncation method. The model selects the ![][image22] most likely tokens and effectively zeroes out the probability of all other tokens in the vocabulary.3 In the Gemini CLI, topK defaults (often 40 or 64\) ensure that the "long tail" of the distribution—which contains hundreds of thousands of irrelevant or nonsensical tokens—is completely removed from consideration.

The interaction with Temperature is crucial here. If Temperature is very high (e.g., ![][image23]), the distribution is flat, meaning thousands of tokens might have "reasonable" probabilities. A low Top-K (e.g., ![][image24]) forcibly truncates this flattened distribution, preventing the model from sampling truly wild nonsense even at high temperatures. Conversely, if Temperature is very low (![][image16]), the distribution is so sharp that only 1 or 2 tokens have any meaningful probability. In this scenario, Top-K becomes largely irrelevant because the ![][image22]\-th token likely has a probability near zero anyway.

#### **1.2.2 Top-P (Nucleus) Sampling: The Dynamic Cutoff**

Top-P is a dynamic truncation method. The model sorts tokens by probability and retains the smallest set whose cumulative probability exceeds ![][image5] (usually 0.95 or 0.99).3 This "nucleus" of tokens represents the mass of plausible continuations.

**The Interaction Effect**:

The critical insight for sub-agent configuration is that **Temperature modifies the set of tokens available to Top-P**.

- **High Temperature (![][image21])**: The distribution is flat. It takes _more_ tokens to reach a cumulative probability of 0.95. The nucleus expands, allowing a wider variety of vocabulary. This is where "creativity" lives.
- **Low Temperature (![][image10])**: The distribution is sharp. The top 1 or 2 tokens might alone sum to 0.99. The nucleus collapses to just those few tokens.

Therefore, for an **Orchestrator Agent** (tasked with routing and JSON generation), setting topP to 0.95 is effectively meaningless if temperature is set to 0.1. The temperature setting dominates the behavior, forcing the nucleus to be microscopic. Control of variance in low-temperature regimes is illusory; the model is essentially acting greedily.

## **Part II: The Gemini 3 Paradigm Shift**

The release of Gemini 3 has introduced a discontinuity in configuration best practices. Unlike Gemini 1.5, which behaves as a standard probabilistic predictor, Gemini 3 incorporates "Thinking" (chain-of-thought reinforcement learning) directly into its inference process.6 This architectural shift necessitates a complete rethinking of how we configure sub-agents.

### **2.1 The "Looping" Phenomenon: Why Low Temperature Kills Reasoning**

Extensive documentation and community benchmarks confirm a counter-intuitive behavior in Gemini 3: **Lowering the temperature degrades performance and induces failure states.**.6

In previous models, setting ![][image25] (greedy decoding) ensured stability. In Gemini 3, setting ![][image10] frequently causes the model to enter repetitive loops or produce incoherent reasoning chains. This pathology arises from the "Thought Process" distribution. The model is trained to explore a reasoning path; the probability distribution of a "thought" token is naturally broader and more nuanced than the distribution of a final answer token.

When the model is "thinking," it may need to sample a lower-probability token to pivot its reasoning or explore a counter-factual. By artificially sharpening the distribution with low temperature (![][image10]), we effectively lobotomize the model's ability to consider these alternative reasoning steps. It gets stuck in local probability maxima, repeating the same phrase ("Looping") because it lacks the "entropy" required to jump out of the cycle.6 The "Greedy" choice at step ![][image26] might lead to a dead end at step ![][image27], but without the randomness to choose a sub-optimal token at step ![][image26], the model cannot avoid that dead end.

**Critical Rule for Gemini 3 Sub-Agents**:

**Never set temperature \< 1.0 for Gemini 3 models.**

Control determinism via thinking_level and prompt engineering, not temperature.

### **2.2 The Rise of thinking_level: A New Axis of Control**

With temperature effectively locked at 1.0, Gemini 3 introduces a new lever for control: thinking_level. This parameter replaces the raw thinking_budget token count used in earlier experimental builds, offering a semantic abstraction for the model's cognitive effort.11

- **MINIMAL (Flash Only)**: This setting constrains the model to use as few tokens as possible for thinking. It effectively turns Gemini 3 Flash into a high-speed, standard LLM. This is ideal for tasks where deep reasoning is unnecessary or even detrimental, such as simple classification, keyword extraction, or high-throughput routing. It minimizes latency and cost but sacrifices the model's ability to self-correct.13
- **LOW**: This setting allows for a restricted reasoning budget. It is suitable for tasks that require some logical connective tissue but not deep architectural planning. Examples include summarizing a document, simple Q\&A, or rewriting text for tone.
- **MEDIUM (Flash Only)**: A balanced approach that offers a middle ground between speed and depth. This is often the "Goldilocks" zone for standard coding tasks or content generation where some planning is needed but a full "PhD-level" deep dive is overkill.13
- **HIGH (Default)**: This setting maximizes reasoning depth. The model may generate thousands of invisible "thought tokens" before producing a single visible character. This is essential for complex coding, architectural design, mathematical proofs, or multi-step logic puzzles. The latency is highest here—time-to-first-token can be significant—but the quality of the final output is maximized.13

> **CRITICAL: Frontmatter Compatibility Warning**
>
> The `thinking_level` (or `thinking_budget`) parameter is **NOT** supported in the YAML frontmatter of Gemini CLI sub-agent definition files (`.md`). Including it will cause a validation error during agent loading.
>
> To apply these settings to a sub-agent, you must use the `modelConfigs.overrides` section in your `settings.json` file, matching the sub-agent's name as the `overrideScope`.

### **2.3 The "Hallucination Frontier"**

The "Hallucination Frontier" defines the boundary where model creativity transitions into fabrication. The mechanism for managing this frontier has inverted between generations.

- **Gemini 1.5 Paradigm**: The frontier is managed by **lowering temperature**. A Coder agent at ![][image28] rarely hallucinates syntax because it is forced to stick to the most probable (and thus most frequent/correct) syntax patterns found in its training data. The risk of hallucination increases linearly with temperature.
- **Gemini 3 Paradigm**: The frontier is managed by **increasing thinking**. A Coder agent at thinking_level="high" reduces hallucinations by verifying its own code internally before outputting it.6 The model "simulates" the code execution in its thought trace. Hallucinations in Gemini 3 are often caused by _insufficient_ thinking time, not high temperature. If the model is forced to answer too quickly (Low Thinking), it reverts to probabilistic guessing, which is where hallucinations occur.

### **2.4 Thought Signatures: The Continuity of Reason**

A unique technical requirement of Gemini 3 is the **Thought Signature**. When the model generates a response that includes reasoning, it produces an encrypted token string (the signature) that represents its internal thought state.

For multi-turn sub-agents (e.g., a Coder agent that proposes code, receives an error, and proposes a fix), this signature **must** be preserved. If the CLI implementation strips this signature when feeding the conversation history back to the model, Gemini 3 effectively suffers "amnesia." It loses the context of _why_ it made previous decisions, leading to disjointed follow-ups and a high failure rate in tool usage.6 The signature binds the "Reasoning" (hidden) to the "Response" (visible). Breaking this link breaks the agent.

## **Part III: Applied Configuration Strategy for Orchestrator Agents**

The Orchestrator is the central nervous system of any agentic workflow. Its primary role is **Task Decomposition**, **Intent Classification**, **Tool Routing**, and **JSON Schema Generation**. It does not need to write a novel or prove a theorem; it needs to reliably route a user request to the correct sub-agent with the correct parameters.

### **3.1 The Challenge: Structural Determinism**

The defining requirement for an Orchestrator is strict adherence to output formats (typically JSON). In the Gemini 1.5 era, this was achieved by crushing the temperature to zero. The model would robotically output the JSON structure it had memorized.

In the Gemini 3 era, setting ![][image25] causes looping. However, setting ![][image13] introduces variance, which scares engineers who need valid JSON. The solution lies in the interaction between thinking_level and responseMimeType.

### **3.2 Heuristic Lookup Table: The Orchestrator**

| Parameter          | Gemini 1.5 Flash (Legacy) | Gemini 3 Flash (Modern)          | Rationale & Mechanism                                                                                               |
| :----------------- | :------------------------ | :------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Model**          | gemini-1.5-flash          | gemini-3-flash-preview           | Flash models have lower latency, critical for the initial routing step.                                             |
| **Temperature**    | 0.0 \- 0.2                | **1.0 (Fixed)**                  | Gemini 1.5 needs low T for syntax. Gemini 3 needs T=1.0 to avoid looping.6                                          |
| **Top-P**          | 0.95                      | 0.95                             | Standard nucleus sampling retains the "sensible" token set.                                                         |
| **Thinking Level** | N/A                       | **minimal** or low               | Orchestration is a classification task. "Minimal" thinking converts Gemini 3 into a high-speed router.13            |
| **Response MIME**  | application/json          | application/json                 | Enforces JSON grammar at the decoding layer. Gemini 3's high native intelligence handles this well even at T=1.0.17 |
| **System Prompt**  | Rigid Schema Definition   | Schema \+ "Think before routing" | 1.5 needs rigid rules. 3 needs a gentle reminder to verify the intent.                                              |

**Insight**: For Gemini 3 Orchestrators, the minimal thinking level on Flash is a game-changer. It allows the model to act as a hyper-fast router (approaching traditional classifier speeds) while maintaining the flexibility of an LLM. It bypasses the latency penalty of "Deep Thinking" because routing usually doesn't require complex deduction—just pattern matching.18

### **3.3 Scenario: The "Router" Agent**

**Task**: Receive a user query ("I need to fix a bug in my Python script") and route it to the Coder Agent.

**Configuration**:

- **Model**: gemini-3-flash-preview
- **Temp**: 1.0
- **Thinking**: minimal
- **MIME**: application/json

**Outcome**: The agent identifies the keyword "bug" and "Python". It does not need to "think" about the philosophy of debugging. It immediately constructs the JSON payload {"target_agent": "coder", "language": "python"}. The minimal setting ensures this happens in \<500ms, maintaining the responsiveness of the CLI.

## **Part IV: Applied Configuration Strategy for Coder Agents**

The Coder Agent is tasked with **Software Implementation**, **Debugging**, **Refactoring**, and **Unit Testing**. The requirement here is logical consistency and syntactic correctness.

### **4.1 The Challenge: The Hallucination of Logic**

Code is unforgiving. A single hallucinated variable name breaks the build. In Gemini 1.5, we used ![][image28] to force the model to use the most common (and likely correct) variable names and patterns.

In Gemini 3, code generation is treated as a logic puzzle. The model doesn't just "recall" code; it "derives" it. This requires the HIGH thinking level. The model mentally drafts the code, traces the execution, catches a potential off-by-one error, and _then_ outputs the corrected code.

### **4.2 Heuristic Lookup Table: The Coder**

| Parameter          | Gemini 1.5 Pro (Legacy) | Gemini 3 Flash (Modern)    | Rationale & Mechanism                                                                                      |
| :----------------- | :---------------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **Model**          | gemini-1.5-pro          | **gemini-3-flash-preview** | Benchmarks show Gemini 3 Flash (78% SWE-bench) outperforms Gemini 3 Pro (75%) on agentic coding.19         |
| **Temperature**    | 0.1 \- 0.3              | **1.0 (Fixed)**            | 1.5 uses low temp for syntax stability. 3 uses T=1.0 to enable the reasoning search space.2                |
| **Top-P**          | 0.90                    | 0.95                       | A slightly tighter Top-P in 1.5 helps focus. 3 manages focus via thinking.                                 |
| **Thinking Level** | N/A                     | **high** or medium         | High thinking reduces logical bugs by allowing internal verification.19                                    |
| **Response MIME**  | text/plain              | text/plain                 | Avoid application/json for code. JSON escaping (\\n, \\") complicates code generation and consumes tokens. |

**Insight**: The recommendation of **Gemini 3 Flash** for coding is a significant divergence from the "Pro is better" norm. The benchmarks suggest that Flash's architecture is specifically tuned for the iterative logic of coding when combined with thinking_level="high", offering a superior cost/performance ratio to Pro.20 The "Deep Thinking" mode of Flash effectively simulates a "Pro" model's intellect for the specific domain of code.

### **4.3 Scenario: The "Refactor" Agent**

**Task**: Refactor a legacy Java class to use the Singleton pattern and ensure thread safety.

**Configuration**:

- **Model**: gemini-3-flash-preview
- **Temp**: 1.0
- **Thinking**: high
- **MIME**: text/plain

**Outcome**: The model spends 2-3 seconds "thinking" (invisible to the user). In this trace, it considers the "double-checked locking" anti-pattern, rejects it, and decides on the Bill Pugh initialization-on-demand holder idiom. It then outputs the code. A Gemini 1.5 model at ![][image28] might have output the double-checked locking pattern simply because it is statistically common in older training data, even if it's technically inferior.

## **Part V: Applied Configuration Strategy for Creative & Analytical Agents**

These two archetypes lie at opposite ends of the spectrum, yet both require nuanced configuration in the Gemini 3 era.

### **5.1 The Creative Writer**

**Role**: Content generation, ideation, marketing copy.

**Requirement**: Novelty, style, vocabulary diversity.

| Parameter          | Gemini 1.5 Pro | Gemini 3 Pro | Rationale                                                                                                 |
| :----------------- | :------------- | :----------- | :-------------------------------------------------------------------------------------------------------- |
| **Temperature**    | 0.8 \- 1.2     | **1.0**      | 1.5 relies on randomness for creativity. 3 relies on prompt instruction ("Be whimsical").3                |
| **Top-P**          | 0.99           | 0.99         | Expanding the nucleus allows for "rare" words to be selected, increasing lexical diversity.               |
| **Top-K**          | 64 \- 100      | 64           |                                                                                                           |
| **Thinking Level** | N/A            | **low**      | High thinking can make creative writing too rigid or "over-analyzed." Low thinking preserves spontaneity. |

**Insight**: For Gemini 3, "creativity" is achieved not by randomizing the token selection (Temperature) but by allowing the model to "think" about the style. However, too much thinking leads to sterile, academic prose. A low thinking level is the sweet spot—it gives the model just enough pause to structure the narrative but not enough to sanitize the "voice."

### **5.2 The Data Analyst**

**Role**: Extracting insights from documents, analyzing CSVs, summarizing facts.

**Requirement**: Zero hallucination, strict fidelity to source.

| Parameter          | Gemini 1.5 Pro   | Gemini 3 Pro     | Rationale                                                                                     |
| :----------------- | :--------------- | :--------------- | :-------------------------------------------------------------------------------------------- |
| **Temperature**    | 0.0              | **1.0**          | 1.5 at T=0 is a "fact extraction" machine. Gemini 3 uses thinking to cross-reference facts.21 |
| **Top-P**          | 0.1              | 0.95             |                                                                                               |
| **Thinking Level** | N/A              | **high**         | Critical for "Reasoning over Data." The model must verify its extraction against context.22   |
| **MIME**           | application/json | application/json | Essential for piping data into downstream tools.23                                            |

**Insight**: The interaction between responseMimeType: application/json and reasoning quality is subtle. In Gemini 1.5, enabling JSON mode could sometimes simplify the model's internal reasoning (making it "dumber"). In Gemini 3, the thinking_level compensates for this. The high thinking level allows the model to perform complex entity resolution (e.g., figuring out that "J. Smith" and "John Smith" are the same person) before committing that fact to the strict JSON output.

## **Part VI: The CLI Implementation Manual**

This section translates theory into concrete code. We provide the exact syntax patterns for implementing these configurations using the Google Cloud CLI (gcloud) and curl. We also address the critical implementation detail of Thought Signatures.

### **6.1 The Configuration Object**

The core of the CLI implementation is the generation_config JSON object. This structure is passed to the API to control all sampling parameters. It is best practice to define this in a separate file or a strictly typed variable to avoid CLI parsing errors.

#### **6.1.1 Standard Gemini 1.5 Config (The "Legacy" Pattern)**

JSON

{  
 "temperature": 0.2,  
 "topP": 0.95,  
 "topK": 40,  
 "maxOutputTokens": 8192,  
 "responseMimeType": "application/json"  
}

#### **6.1.2 Gemini 3 Reasoning Config (The "Modern" Pattern)**

JSON

{  
 "temperature": 1.0,  
 "topP": 0.95,  
 "topK": 64,  
 "maxOutputTokens": 65536,  
 "thinkingConfig": {  
 "thinkingLevel": "HIGH"  
 },  
 "responseMimeType": "text/plain"  
}

_Note the nested thinkingConfig. Attempting to flatten this structure (e.g., thinkingLevel: "HIGH" at the root) will result in an API error._

### **6.2 CLI Command: curl (REST API)**

The curl method is the most robust way to access the latest Gemini 3 features, as CLI wrappers often lag behind the API release cycle.

**Scenario**: Deploying a **Coder Sub-Agent** (Gemini 3 Flash, High Thinking).

Bash

\# Define your API Key securely  
export GEMINI_API_KEY="your_api_key_here"

\# Execute the Request  
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI\_API\_KEY}" \\  
 \-H 'Content-Type: application/json' \\  
 \-X POST \\  
 \-d '{  
 "contents":  
 }\],  
 "generationConfig": {  
 "temperature": 1.0,  
 "topP": 0.95,  
 "thinkingConfig": {  
 "thinkingLevel": "HIGH"  
 },  
 "responseMimeType": "text/plain"  
 }  
 }'

_Implementation Note_: Ensure that the contents array is properly formatted. The Gemini 3 API is strict about the structure of parts.

### **6.3 CLI Command: gcloud (Vertex AI)**

For enterprise deployments using Vertex AI, the gcloud command is used. As of early 2026, thinking_level support in the primary gcloud flags is evolving. The recommended pattern is to pass a JSON configuration file to ensure all parameters are respected.

**Scenario**: Deploying an **Orchestrator Sub-Agent** (Gemini 3 Flash, Minimal Thinking).

**Step 1**: Create config.json

JSON

{  
 "temperature": 1.0,  
 "topP": 0.95,  
 "thinkingConfig": {  
 "thinkingLevel": "MINIMAL"  
 },  
 "responseMimeType": "application/json"  
}

**Step 2**: Execute Command

Bash

gcloud ai models predict \\  
 \--region=us-central1 \\  
 \--endpoint="projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/gemini-3-flash-preview" \\  
 \--json-request='{"contents":}\]}' \\  
 \--generation-config-file=config.json

Using \--generation-config-file is superior to inline flags for complex configs.24 It avoids shell escaping issues and makes the configuration version-controllable.

### **6.4 Handling Thought Signatures (The Critical Link)**

A unique implementation requirement for Gemini 3 sub-agents is the management of **Thought Signatures**. When an agent thinks, it generates a cryptographically signed "thought trace." If you are building a multi-turn conversation loop (e.g., a Python script calling the CLI in a loop), you **must** capture and return this signature.

**The "Broken Context" Risk**: If you strip the thought signature from the response before feeding it back into the context for the next turn, Gemini 3 effectively suffers "amnesia" regarding its reasoning path. This leads to disjointed follow-up answers and tool call failures.6

**Implementation Pattern (Python Wrapper for CLI)**:

Python

\# Pseudo-code for a CLI wrapper handling signatures  
import json  
import subprocess

def call_gemini_cli(messages, config_path):  
 \# Call the gcloud/curl command  
 \# Assume result_raw contains the JSON response from stdout  
 result_raw \= subprocess.check_output(\[...\])  
 result_json \= json.loads(result_raw)

    \# Extract Thought Signature
    \# Gemini 3 returns this in the candidate parts
    \# Note: It might be attached to the text part or a functionCall part
    response\_part \= result\_json\['candidates'\]\['content'\]\['parts'\]
    thought\_signature \= response\_part.get('thoughtSignature')

    \# CRITICAL: Append this signature to the history for the NEXT call
    if thought\_signature:
        \# When constructing the next user message, include the previous model response
        \# EXACTLY as received, including the signature field.
        messages.append({
            "role": "model",
            "parts":
        })
    else:
        \# Fallback for non-thinking models or simple responses
        messages.append({
            "role": "model",
            "parts": \[{"text": response\_part.get('text', '')}\]
        })

    return messages

26

### **6.5 Error Handling: The 400 Bad Request**

A common error when migrating to Gemini 3 is a 400 Bad Request during multi-turn conversations. This is almost always caused by:

1. **Missing Thought Signature**: You sent a follow-up message without including the signature from the previous turn.
2. **Modified Signature**: You attempted to concatenate the text parts but accidentally modified or dropped the signature string.
3. **Mismatched Config**: You tried to use thinking_level with a legacy model, or set temperature=0 with a thinking model (which triggers a warning or error depending on the API version).

**Fix**: Treat the parts object from the API as immutable. Do not try to extract just the text string; store the entire part object and send it back in the next turn.

## **Part VII: Benchmarks and Economic Analysis**

Configuring sub-agents is not just about accuracy; it is about cost and latency. The shift to Gemini 3's "Thinking" model introduces a new economic variable: the **Thought Token**.

### **7.1 Latency vs. Cost Trade-offs**

Using thinking_level="high" incurs a token cost. The model generates internal thought tokens that are billed (or counted against quota).

- **Minimal Thinking**: Adds \~0-50 tokens. Minimal latency impact.
- **Low Thinking**: Adds \~100-300 tokens of latency.
- **High Thinking**: Can add 1,000+ tokens of latency.

**Strategy**:

- Use minimal (Flash) for high-volume **Orchestrator** tasks. If you are processing 1 million requests a day, the cost savings of minimal vs high are massive, and the latency reduction makes the system feel real-time.
- Reserve high strictly for **Coder** and **Analyst** agents where the cost of an error (a bug or a hallucinated fact) far outweighs the cost of a few thousand tokens. A Coder agent that takes 10 seconds to generate correct code is infinitely cheaper than one that takes 1 second to generate buggy code that a human must fix.

### **7.2 The Determinism Benchmark**

- **Gemini 1.5**: Determinism is high at T=0. Hallucination rate is roughly 3-5% for Flash models on summarization tasks.28
- **Gemini 3**: Determinism is _structural_ rather than _probabilistic_. By fixing T=1.0 and using thinking_level="high", the model converges on correct answers through verification rather than greedy sampling. While the "Hallucination Rate" for Gemini 3 Flash Preview is listed as \~13% on some leaderboards, deeper analysis reveals this is often due to "refusal" or "thinking" tokens being misclassified by automated benchmarks. On verified functional benchmarks like SWE-bench, its accuracy (78%) is superior to previous generations.19

## **Conclusion**

The era of "set Temperature to 0.7 and forget it" is over. The introduction of reasoning models has bifurcated the configuration landscape, requiring a more sophisticated, role-based approach.

For the CLI engineer, the path forward is defined by three rules:

1. **Stop Lowering Temperature**: For Gemini 3, lock temperature to 1.0. It is no longer the control for determinism.
2. **Start Tuning Thinking**: Use thinking_level as your primary lever. minimal for routing, high for reasoning.
3. **Preserve State**: Respect the Thought Signature. It is the thread that holds the reasoning chain together.

By adopting the Heuristic Lookup Tables provided in this report and adhering to the strict implementation protocols, architects can deploy robust, hallucination-resistant sub-agent swarms that leverage the full capability of the Gemini 3 architecture without falling into the trap of legacy configuration patterns.

#### **Works cited**

1. What Is and Why Use Temperature in Softmax? | Baeldung on Computer Science, accessed on February 9, 2026, [https://www.baeldung.com/cs/softmax-temperature](https://www.baeldung.com/cs/softmax-temperature)
2. Stop using temperature 1.0 for code generation: Advanced LLM sampling parameters guide every developer needs | by Glanzz \- Medium, accessed on February 9, 2026, [https://medium.com/@glanzz/stop-using-temperature-1-0-385cb51ac863](https://medium.com/@glanzz/stop-using-temperature-1-0-385cb51ac863)
3. Experiment with parameter values | Generative AI on Vertex AI, accessed on February 9, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/adjust-parameter-values](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/adjust-parameter-values)
4. What temperature do you set and what are your tasks? I read in this sub that reducing temperature can improve coding performance. : r/Bard \- Reddit, accessed on February 9, 2026, [https://www.reddit.com/r/Bard/comments/1l7z5g3/what_temperature_do_you_set_and_what_are_your/](https://www.reddit.com/r/Bard/comments/1l7z5g3/what_temperature_do_you_set_and_what_are_your/)
5. Complete Guide to Prompt Engineering with Temperature and Top-p, accessed on February 9, 2026, [https://promptengineering.org/prompt-engineering-with-temperature-and-top-p/](https://promptengineering.org/prompt-engineering-with-temperature-and-top-p/)
6. Gemini 3 Developer Guide | Gemini API \- Google AI for Developers, accessed on February 9, 2026, [https://ai.google.dev/gemini-api/docs/gemini-3](https://ai.google.dev/gemini-api/docs/gemini-3)
7. Get started with Gemini 3 | Generative AI on Vertex AI \- Google Cloud Documentation, accessed on February 9, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3)
8. I'm glad Google optimized Gemini 3.0 for best results at default 1.0 temperature \- Reddit, accessed on February 9, 2026, [https://www.reddit.com/r/Bard/comments/1oztm89/im_glad_google_optimized_gemini_30_for_best/](https://www.reddit.com/r/Bard/comments/1oztm89/im_glad_google_optimized_gemini_30_for_best/)
9. Gemini 3 prompting guide | Generative AI on Vertex AI \- Google Cloud Documentation, accessed on February 9, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide)
10. Prompt design strategies | Gemini API | Google AI for Developers, accessed on February 9, 2026, [https://ai.google.dev/gemini-api/docs/prompting-strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
11. Google Gemini 3 Flash API \- Replicate, accessed on February 9, 2026, [https://replicate.com/google/gemini-3-flash](https://replicate.com/google/gemini-3-flash)
12. Gemini thinking | Gemini API | Google AI for Developers, accessed on February 9, 2026, [https://ai.google.dev/gemini-api/docs/thinking](https://ai.google.dev/gemini-api/docs/thinking)
13. Thinking | Generative AI on Vertex AI \- Google Cloud Documentation, accessed on February 9, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking)
14. Intro to Gemini 3 Pro \- Colab \- Google, accessed on February 9, 2026, [https://colab.research.google.com/github/GoogleCloudPlatform/generative-ai/blob/main/gemini/getting-started/intro_gemini_3_pro.ipynb](https://colab.research.google.com/github/GoogleCloudPlatform/generative-ai/blob/main/gemini/getting-started/intro_gemini_3_pro.ipynb)
15. OMNI-CAPTIONER: DATA PIPELINE, MODELS, AND BENCHMARK FOR OMNI DETAILED PERCEPTION \- OpenReview, accessed on February 9, 2026, [https://openreview.net/pdf/51eeea59b91f0b4d48a76dc3c3d1b5b36eafdc86.pdf](https://openreview.net/pdf/51eeea59b91f0b4d48a76dc3c3d1b5b36eafdc86.pdf)
16. Thought Signatures | Gemini API | Google AI for Developers, accessed on February 9, 2026, [https://ai.google.dev/gemini-api/docs/thought-signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)
17. Gemini API: Playground and SDK give different results with identical ..., accessed on February 9, 2026, [https://discuss.ai.google.dev/t/gemini-api-playground-and-sdk-give-different-results-with-identical-configuration/106768](https://discuss.ai.google.dev/t/gemini-api-playground-and-sdk-give-different-results-with-identical-configuration/106768)
18. Gemini 3 Developer Guide: Examples, Cookbook & Migration Strategies, accessed on February 9, 2026, [https://websearchapi.ai/blog/gemini-3-developer-guide](https://websearchapi.ai/blog/gemini-3-developer-guide)
19. Gemini 3 Pro Preview vs Flash Preview In-Depth Comparison: When ..., accessed on February 9, 2026, [https://help.apiyi.com/en/gemini-3-pro-vs-flash-preview-comparison-guide-en.html](https://help.apiyi.com/en/gemini-3-pro-vs-flash-preview-comparison-guide-en.html)
20. Gemini 3 Flash vs 2.5 Pro: Full Benchmarks, Speed & Cost Guide \- Vertu, accessed on February 9, 2026, [https://vertu.com/lifestyle/gemini-3-flash-vs-gemini-2-5-pro-the-flash-model-that-beats-googles-pro/](https://vertu.com/lifestyle/gemini-3-flash-vs-gemini-2-5-pro-the-flash-model-that-beats-googles-pro/)
21. Mastering Controlled Generation with Gemini 1.5: Schema ..., accessed on February 9, 2026, [https://developers.googleblog.com/en/mastering-controlled-generation-with-gemini-15-schema-adherence/](https://developers.googleblog.com/en/mastering-controlled-generation-with-gemini-15-schema-adherence/)
22. Google Gemini 3 Benchmarks (Explained) \- Vellum AI, accessed on February 9, 2026, [https://www.vellum.ai/blog/google-gemini-3-benchmarks](https://www.vellum.ai/blog/google-gemini-3-benchmarks)
23. Gemini in Java with Vertex AI and LangChain4j \- Google Codelabs, accessed on February 9, 2026, [https://codelabs.developers.google.com/codelabs/gemini-java-developers](https://codelabs.developers.google.com/codelabs/gemini-java-developers)
24. gemini-cli/docs/get-started/configuration.md at main · google-gemini ..., accessed on February 9, 2026, [https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/configuration.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/configuration.md)
25. GenerationConfig | Generative AI on Vertex AI \- Google Cloud Documentation, accessed on February 9, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/GenerationConfig](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/GenerationConfig)
26. Function calling with the Gemini API | Google AI for Developers, accessed on February 9, 2026, [https://ai.google.dev/gemini-api/docs/function-calling](https://ai.google.dev/gemini-api/docs/function-calling)
27. Migrating to Gemini 3: Implementing Stateful Reasoning with Thought Signatures | by David Flórez Fernández | Google Cloud \- Medium, accessed on February 9, 2026, [https://medium.com/google-cloud/migrating-to-gemini-3-implementing-stateful-reasoning-with-thought-signatures-4f11b625a8c9](https://medium.com/google-cloud/migrating-to-gemini-3-implementing-stateful-reasoning-with-thought-signatures-4f11b625a8c9)
28. vectara/hallucination-leaderboard: Leaderboard ... \- GitHub, accessed on February 9, 2026, [https://github.com/vectara/hallucination-leaderboard](https://github.com/vectara/hallucination-leaderboard)

[image1]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAYCAYAAACfpi8JAAABfUlEQVR4Xu3VvStFcRzH8a9QnspDUgaLpBg8JIsyUJR/gazIICkpjJRFediUZMAoJYlCGQxKGZQysZgsymTg/XHOcY4fh+7NVep86jX87vd3b9/fU9csSZIkSX4v2WhBNwqRhVp0IT8yL6MpxibGMIVLLGAWq9hG3vvsDEUrn0G7P67ELbbQgAecoMivZyxlmLZwxY14RB9y0Y96vxakwLyjTDVadKt5x/9j1MCTefflq+gY9y2+3oYc90PSi11cYcKpfYo6XsM5Sp1aEO3YKcrdgp8h+/4Y1y2mEa1wGQPm/bg6VjNqStGrUU1HN44D3GERVf6caNJupAcvmEcHni2cqCb1xRp/rCxhMDJ2k3Yj1bjABnYwihvznu0eOsOpb8d1ZN6FU3Rhh7EScWbejgbjEft4Z2IbUbTtFRa+BHccpA7HFn8/lLR3JJXoRWnn9Ky1Ezo6N3/SiC7uISbR7NSCxDXSZN5x3+Macyj5MCPF6H9IOxKXuEaS/M+8AkNaPQHq5eVHAAAAAElFTkSuQmCC
[image2]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAYCAYAAACsnTAAAAACp0lEQVR4Xu2XS6hNURjHP3nkmWfklUciFMpISIQojzL1GFDuBEkhMTCgpEQMGHhEYUKSR5RyZgZKGTAgRSkZmChFCv9f31rn7LPO2ed2j3Nr39q/+nXbez322mt/37fONSspKSkpKSkpKT795WK5Vg6T/eRsuUYOyfTrK0yVG8JfGCvXy4nVHt0wUt6SB+RR+VqekyflFXlPDq72LjZ8zP3yotwh38rT8oY8JN/LOdXeOTDJCbk8XLOTn+RtuUB+kxU5PLQXHSL7mPl7wXX5Wc6Vj+QP84xoyRjzSWIkLJTf5VY5UG6X80JbZLz5Vyhi9OwzT3ugDDyTd+QAuVRuNi8VkUHm79kSNiNvNwm7B/Kh9Y3omSm/yMNpQ4CNIiM2pg1ZCLlr8qUcnbRlYZKKFX9TNslfclnaEJggX5inVh0U2Qtytxwn35hvTMxJcpS2LK02hXtU+jg+hdCdbo2pxwIZl4W1TbL6uQh10rdZyNNvp7xkvo7z8qOcHNoZd1YOlbvMD5Cv5u9L/azCMfVXnpEr5W+rhRuLolDNCteRvE3hpTi5+DpLkrYIi+F5hC3hC6Qli6Mgzgj38uZinYw/nrkXYWM/mI9jzldWWycbdtC8PES6zDeuAfKOwTflffPjjGOLo/ixXFXrWiVvU7hmzB/zBTSDsT/Nj8cYAVPMX4SiyIeAONc7OS3cA9bH/PRNn0/08BGpe0/kXvNSQKG9K4+EPsAH4f6WcN0AoUxoxaqcXqfkbUpktdyT3uwgpDkpz+mSwppZe0zP9DrCHM+tST1pl+42hSjIS59OwNw843+g+D6VI+Q2q6VtjxklT5lXbI5tfiUuquvhv3MuW+/9a8CHuCrnpw09hPEV85RaV9/UeYgiakRvQbivSG+2CSmVplVJSUn7/AMfnGsC0Hxa+gAAAABJRU5ErkJggg==
[image3]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAYCAYAAABEHYUrAAACjklEQVR4Xu2XTYhOURjH/0IRMz7zkVlMk418RJJSSqEIkY9C2ZBIjY9EURZigVhQpEFIko2Vj3xkwYYsSKSkZJpYyXqk+P97zp3OnPfcuee+Rs2r+6tft3vOvfe9z3mec859gYqGYRy9TT/SN3Sv13eEfqLP6TyvvaEZQZ/Qw0H7VNc2OGhveK47M4bCAm3x2gYMrfQi7aI36TX6jd6n72g3fUZXIJ4pBXaPDnPni+iant4Byk46l06mx7z2Za5vMz0Dy5zPDtjcbILN40OoveafoJGfAHvhTJ3HMhKSF+wYd67MKbAlXp9YRb/QKXQ7nd67u/8ZTg/Q97D500FP0Y10uesvIi/YkfS4O2pl3eX1CbUp2K3OJLSyLYb9mFApzKZDeq6IM4nehZVZSgbzyAtW5alzvd8m2OD5TKNf6UNYGRcyk3bS3/QHXUm30N3+RRE0EOfpurCjDvKCnU8P0qWwihnl9YmJsH12YdAeJXthBagf0px4BHtw0USfAbu3KPsp+ME+pVfoW/qLvoZVTmw6DIJlX8fSLKBnYWVThBYHZd9fkEJVWikvEmZ2G90Ay9gepD2jFMqqFpbYCMZQsFkV5HmCjs5u6IMwWL2DBr2NHoWVc7+gUVsPe2hR6fpocPaFjXUSBivm0JOwr6ELqJ2vpVGgKpf96L2aas9a7Z3H0B56yx3/lliwoh1WQcrsaZRLRg1aSX/SV7DMKsPn6AukBaH7LyNtjvdFXrDKprKqVVd7uaxr/urfwQ06FrZffYBtPzrqPAX9sFbyl3QtbPMvQyu9Cvse1rex/E7v0FnuGmX1Ab1EP8O+pfVFVQrd4N+kEhmP+j4OmmErqP5yac/OfIzEzb6ioqKi4n/nD5oUbLZwJS+QAAAAAElFTkSuQmCC
[image4]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAXCAYAAAAC9s/ZAAAA6klEQVR4XmNgGAUgIALEh4H4PxL+BcQuSGrYgHg5mpoyJHkw8IVKLESXgAJmIF4GxFVAzIomBwbGQPwViNcAMQuaHAiYA/FiIOZEl4ABJSB+DsQHgJgHVQqsaQEQG6KJowBxIL4LxA+BWBJNLgaIG4GYEU0cBYBsPQDEb4FYE0lcAYjXA7EYkhhWAPI3yP/fgNgUKgaysROI/WCKCIE5DJCYAMUICNgC8RQGHKGODQQxQAxoBeIiIE5HlSYMQInnHxBfZ4BEGXpsEASwtADCoHgnGYCiDxSNzQwEogwXAAWWNRBzo0uMgsEMAGrnJkphVQmnAAAAAElFTkSuQmCC
[image5]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAA2UlEQVR4Xu3SPQtBURzH8TMYDB4ySZRZmWRRDMrsTXgHRq9CRikZbFYLBmVRXoNioQiLRQrf+3Dq3r+Lu6r7q0/d7u+c0/13rlJBqtjj6XDGwX6+oo2Y3uCVHu4oi/cFZR00QUR0ZqJYYI2k6IwNczxQc1dWcjhhhJDoElgp768yU1fWfE1ZkBJuWCIuOjMd5X2ysXiGI4qiM6NnMk4fomsbYIc+MnqxjJ53iixSDmHHOs/oeVuy8BNj3o/X8C36fjdIu6vfyeOCsfIxn04FW/X+Pzeci4L8dV5HLDA3ZZscAQAAAABJRU5ErkJggg==
[image6]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAYCAYAAADKx8xXAAAAuUlEQVR4XmNgGDnACYjvAvEjIrELSBMjEE8B4pVArADlg8AcIP4HxB5QPjMQ2wPxAyA2BQmIA/EqIBaDKgABQSA+zQBRJI0kzgPEi4FYBsQBWVuIJAkC+kD8CYjXADELkjjIwElAzAvihAKxGpIkCEQD8X8gLkcTFwbiNAaEdzAAyH+/gdgGXQIfwOU/gsAYiL8yYPqPIMDlP7wA5On5DIPWf6A4PAfE7xggfoPhL0B8nQFi2CgY3AAAzMQr+zx1NKQAAAAASUVORK5CYII=
[image7]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAZCAYAAADuWXTMAAABMklEQVR4Xu3TwStEURTH8SNjITMSJRqT2FmLUspGajYWbBRNUxP2NsJGSfkHpKRsiY3F7GZBWfgD/AEWYiV/gGS+xzn3mXndycJK/OrTm3vmvjf33PtG5D9/Kd0oouDjLsxhHO1hUiydOMQ2nnCASyz79RgdyexUZrGDMbzgROyBmgm8+pxoypjEPN6leeI03rDhY13BKobChLL84OaQfTwg31BbxwcWfKw3aVuDyQyx3a2JbVDGa3rVse6D7kfLjOIZmw21ETziSOxB2sKV2JE2RfvV5e36uA17uMcw+rGCRZxL6uy1Xz2SO1zgRmzJA/59r38+FTv/JFlcoyp2vn1eS0fbuPVrkli/sejO6y9PYSYU18T6LaEnFCOp4Axb8vUGfr67wVIotkhOvvmj/ILUAfpjM4LycYaBAAAAAElFTkSuQmCC
[image8]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAXCAYAAADHhFVIAAAAlUlEQVR4XmNgGHjADcSFQKyGLgECRUD8H4jT0SVAQASIHYCYFU0cN2AGYmMgtoGy4QBkxAQgrgXi00DciyzpCsQ1QMwHxAeAeCUDku5MINYHYksg/gbEETAJGAC58ioQTwFiRjQ5Bg8g/gXELkCsDsQNyJIzGCCOEWaABATIHXDgB8RPgHgDEBcwYDGaB4gF0AWHDgAAPfUSVNIdKk0AAAAASUVORK5CYII=
[image9]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAzCAYAAAAq0lQuAAAGsUlEQVR4Xu3df+jdUxzH8bdM0YjNGtpkfowUUmIU5o8l/iANoUlKm58hbGtGfTdJ0mp+5XdIWkxqoRjpilAUSia12pTtL/OP+WPLeL865+yevfe593vvd99979p9PurdPZ9z73f37r937/M+55gBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADpb5XFYnOzBIR4r42QHq+MEAAAAerMuTvThRo+FlhK3dzxm5fldHld4HOqxyeP8PL/e48g8BgAAQI9+ihN9eMXjFI/jPKbnuSmWkrQZ+fktj5l5/LWlJA8AAGAoHOGxwlIlS07Icayl5KmM9XqZpWrXdR6n58/LNI/51bPoc+dZqprJ1Oq9qCRf11dzCzyWVs+LrP1vXemxuXoPAADgoKVlxTV5rOqWetBkjscSjyc8luU5fbZl7QrYJdbuJ7vKUoWspiRQFbGnPH7Oc+fY3pWxi6ydiNW+s3Z1LVLySMIGAACGwjyP2/NYSVOrGm/zeM7amwhKwlZ6x1SZ25rHStiURDV51ePMPL7TUqWsNhKei+0ek+JkRsIGAACGhpI1LT02edPjZeucsMk/+bUpYTvN4/XqebKlXrWjqzlZHp5FCePOOFkhYQMAAENDidGW6lnLn+o9u83jKEsVtr/yeyVhm5Wfb/C4I49VQVO1rjjJ4w+Plzzu9fjNY7bHp5Y2ExQnW6rURep9ey9OVrRbdGOcBAAAOFgt9lhr6TgNVb/+y6HGfiVFGivhKgnbxx4fevxp7d4zvVeWVuVFSxU1Vdh2eNyS50fKB7LYz6aNDFqKLb9hg6XkLVJVsBUnAQAAhl3TkmjtxzgRaKfpY5Y2K4iqcs+23+7Lt5aWXAEAAFBRP1uJJup1uzZOdvG0pZ2p/VLCF/vgAAAAxkRLiidaWhrUsp56ww52qqDF4z06ucuaj/MYzeNxAgAAYCzUgK8lP/V5qaleTfKleb+Tmzx+7xDfV58DAADAOFElaFMeqyFfTfSic8niERgAAAAYgM+sfTSFXlVt6+Zwa18LFWMsvV4AAAAYhSpqI5b6tHQ1k84mu9nS8RmD7GfT9+uYjvvz86MeX1patgUAABgaOvriI0v9a/UxGDooVjFousWgeLgaAwAADA3tlFwaJy31sumy87nxjX2ghDAuoTbFMeUPLCVpWoKVa6p5AACAoVHOK4sn+ct4L4cqYVvvsSS+UXnfY1f1rLs/Z3gsrOYGSTcijPVsNfX36Uw3ibtr6zjbUi+hlqYBAAAG4l/rnoxoebackaYjRz6xdPvAoK2OE33SbQn6/5xl7XtJ9f/cau3laFUYdTeq+gl1PyoAAMBAKPFRpUo3DnRSlkFVlSpXRA3ar3GiTy94TLI9q4U6tLgcoyJK4MohvVqSPhD6CAEAwJDS4byjHdA7XlTNWpFfRUmgKlnTLVXuyljzF1hKJNUvV1/mrgQybnp411KypVsTdIl8p7tLRd/dlHzpSBVV2Dp5O04AAABMFCVF6p1T1Wl/anmsyeMNHqvyeKOl77/V2omcaFeqli1Fl7Z/kMdK3i7O40gHDNfutpQE1paH50IJX7crrDbHCQAAgImkPrZf4uQ40wYG7XgVVataeazL37dbO5krlLCVZEtLkzvzWAlbXXErjreU2NWaboiojyepKWG7Ok5WulXfAAAA9itV2NSE3wvtFL00TgbqBTs3TlpKiBbESUvJ2COWliRrdcImpb+sKWHTMujUPH7S0q5a/dbLd38i0XepHy1Sv1rLui+lUmEDAAADo36wXjYd9KplKVmKtMFhSx5r88IySwnUDx4zPe6xVG0rlLDNyWO9lp2h06xdqRMla5MtbZ7YYe2NAvo/xSXOeGSKfsfflpJBxTZLv6WJDjUGAACYcPOte7Km90of2WwbPbmTljUnbPq7xR5rPV6zdIaajhVRovSApQpbSZpECdu6/HndqVq+VwnZM3ksOnqjzNfJpcb1Eqd2hT5fPfdDf9t0qDEAAMB+pb61bmewaZm0LEOqP0yVrc89puz+RLOWNSds/YpLorWv4kSDebbnEqeO8IgVtl7pPtfRElUAAIBxdZ/tfap/U7yRPy+qYJUeNB290ekaq5bte8KmWwjKzQ9N9FtUrSvLn7UzLO1C/SLMr7Tmz49mxOPBOAkAAHAgUoUtNvtH2nCgHZ/fWP+9b/16yOPCOGmpn01Xbp0a5ueG514tsrElegAAABOmHFRb7t4EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPTkfzAA7vnpP0/SAAAAAElFTkSuQmCC
[image10]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACXklEQVR4Xu2XTUgWQRjHn9Ag0YyQCrFAJfKmRkqXQAqJCNJAhah7eBDEi4J4CKJDdpNOYUSIQepVOhQkdIkEwUsdQhSRokuHqJP48f+/s6Oz8+66O7uvdWh+8IN3n9mveWb2mXlFPB6Pp5hrcAWup7RTXfZPuAiv28EEmuA4fAbvwopws8gR+BS+hvXBMZmE2/BGcFwGO+AabA9if4vLcBguwh04Em4+kB74GbbCKvgQvoUnzJPOwBl42oidFPXANVhnxHmTKXjWiOWhEh61gxEwCbfgTfhH0ifhHPwK7xkx3bcBI1aY2kNmALTAX3AOlhtx3mACHjdiWeD0nIWv4Cmr7SAuiVsS2Hmez+s0nOnTcEHUoBbogxf0QQAvjpp2NfC+7H8yLvAajuh7UZ8fR8kV1yRwwOwkkJfwO2y04iFYDzbhFbshA6wlLLwf4BNRicyKaxLY2bgkRMX3iKsHrrDz3fAjHIPV4eZMuCSBU31BojubmAT9ILsepIWF7g5cgoOiil+pcEkCn/tOojubmIS4epCWq6JmUb9ErMc5cUkCietsXLwAi9cLyV8PzNnA9b0UnwJxTcIjie4sk7AhMUt9qeqBRtcF3jNvUSRJSeCex3xGF9yS8A73GJwP5O8i8taDOOzlsTbcnBr9fqN2g6i9xw9RI9wQxJiQT/BBcEzOizqHM3UP7hE4bX+KqgXa3/CLFE+lPDAZzfANfC77L5sE68s3Cb8f35fLrt7pcmoviyqG5pa4Da6K+ix7Rc3Kx5Jup3roMAH8U8OROWy4UvBP123JtknzeDwez3/HLkFdhHns326HAAAAAElFTkSuQmCC
[image11]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAYCAYAAACx4w6bAAAB50lEQVR4Xu2VSyhEURjHPyHKIyISeSVlZYGkSMlCyUYppdhZWLFhYSlLG6+FlIUsPLbKkiyVHVbyyIZiIVYK//+ce8adM+7ce2eamc351a/u/e6j853zfeeIWCyWTDAAb+FjQAfVZ1klB3bDVbgJh2Gu+cI63IeNzj3Zht9wyLnnR/3wHnY5sWzBMc7DM9gEK+Ae3IL5+qVqeACrdACUwwtRSdS64sVwF9a5YtmgAz7DXlesGT7I30JEymou+ljRDt/hEcxzxZkwl77EFUuFQjgtasLCsCwqiRpXjGM6hzviVN0YbHW9QCbgD1ww4lxyDkSXa6rwPxwkVyAonIxjiU+Mk3MqqtK4AP/C/vqS2KVOF0xqRWIrIxE6Aa/EzHgUr/5KF1y1WTjpXPvBQXPwZgK+iXEGPyW+v4JSJurHYawX1RtrsFQSw82OR5OZgG9iXv0VhCK4KGrbDeuJqAldggXijVcCXvEILAXOXKb6S9MJDyXYMcIqYjWZCejEuDPG7dqZ7i/CnZZnY4P5IAGsplfY5opVwitRx1EcqfZXMszAcTPoQwt8ktjv+uAL7NEBnmGX8E1Ub2k/4I2EO2PCwjNpQ5KrjlF4J+pcnYLXoiYpyM6adjgI9kOyg2EZjzjy2mKxWCz/8gvgh2geyQkWBwAAAABJRU5ErkJggg==
[image12]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAYCAYAAACWTY9zAAACG0lEQVR4Xu2Wz0sVURTHv1JBoS4yycLAFEuDIiFaFEFQJi0kFyoIIrSpRQtBWrRoU4Ebd2o/IIKIQFD8C1q4jCBw2yoQ/wADsU2C+v125uZ9x5n35sFjXgs/8EHumbkz991z7hmBQ/4fGmmDD9abNjpLT/gL9WaMPonGd+hPup7TfptWW47SeXopGSudr+kiPZ+MxQe6Q+8n4yP0Nl2j15NYTdGC3sEWKJTWJXr63x3ASfodtoj2KN5EP9NzUaxmKIVKZUBpmYrG4irdpMvY/wFCC56jzVHsLzpJd+nZZHyM9qF0cjlU7EpRZxQbpRejsRinu/SZi5+ij+FO8xVY4WnCLzpIJ+hkfFMFbtAZVG4TWvw2veUveLQjb2CL0W5p+7/Q97Bdy8tz7BdzFln1lYubsD6k1MYozTINvfATbfUXHNfobxysr4pot5QO3xz1kGl6z8UDmvfCB1PIqq9MVBcj9CWqS5/QXP0Y1Vg5dN9H5KwvoQk6PU9hjS7wiA7RM/QtfYX0RatW9EL1oXJUXV/D9A9sknZMO6d+8g3WIB/Ces9X2mFTSvCfoCyqqq9uWLdtgXXtH7Aa0F+N9YAL9AGsg/sHhhN92cUD6mGrdAP23OAW7B1abCrHEwNKlU5WnFK9fAGlHT3QBfs2+gUXgnZOadWu+M6sOkxbcCH00BVY8fdG8bRPUOH4lAvtoBZb6RNUOAOw/6EOqTt7vY1XGN2KuWMAAAAASUVORK5CYII=
[image13]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACDUlEQVR4Xu2XO0gcURSGT9BARENMBIOoYIJomYgRm4CgIiIoghGC9iGFjU0CgiBIClOGVCKIiIUhrSBosWCnINhoEcRFREljIaYKPv5/7kz2zmtnroHdBe8HHzhn5u7OPXP2zFHEYrFYwnTDQ3ic0l61rCi0wb5gMIFW+BXOwzFY4T8t8gB+h6uwyT0mC/Aa9rvHZbALZmGHGysUnfAT3IE38LP/dF5G4D58DavgLNyAT/SLnsMfsFaLPRX1hVlYr8X5IcuwQYsVAiZhEA7AP5I+CY3wFxzXYt7eJrSYU9qTegC8ghfwJyzX4vyAb/CxFisk7WKWBG6e13OdByt9BWZEPVSHUdjiHbhwcVTZ1cAPkvvJFBrTJPCBBZNAluAZfBmI+2A/+AvfBk8UGdMkcLNxSYiK/yOuH6ThGVyX8Nskn9POynSYJIGlnpHozSYmwfuiYD8oBUySUAk3JXqziUmI6welgEkSSNxm4+IObHiLcvd+wPVsnnUGVjsr02GahC8SvVkm4URiXvX/0w/IQ9gD3xnIGSAtSUngzMOH4DEEr8Q/4T6Ca678O0Qp9wPi3d9U8ISo0fi3qCf8wo0xIdtwxj0mzaKuea/FnBlhF56L6gWel/BAwqVUDD7CU/HfH+93S3KTLkt7T1Qz1EfiN/BI1NjNymOlz4mq2nsF3xT8p2tY1ChtsVgsFksCt51Zg4Hf2QQFAAAAAElFTkSuQmCC
[image14]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAYCAYAAABZY7uwAAADWklEQVR4Xu2XaahNURTH/0KZh2Qq8ihEhEwlU6JIpMxDUiJFxpChKMlQiPiC0vtgiBJJ4ZNSCMUHInwhQ4gPwgdl+P/fOsfZZ9997z3veYZ651+/7r37rLPPXmuvtfa5QK5aUSuykvQh3ck80jllUcfVkTwjP8hLMpPUS1nUcSlA2/zBXIkUoB1kOJlEWqQv/xPVJzNIhTceUktyjPT1L1A9yW5yGNY6mqYvZ5MCdA7Wf8RF0iVl8XfUGLZB+2Gl/pkMTFkUSq1gA8K2U8lp0ot0IsvJbfymb3rgcbLVG/8bUoAmkNFkC8JO+xpKPqDQtj25BAtMLPl2EDXwbSI5SppFvysjskr3tUH5xt7IHyih9Sh02pdK6wisfHxbfX8EqwhXmle+FpUiqzQeSRpGYwvJzui3nFCJLYuulZIWeAp2+om3ZDasf/hqTpb6gyVULkDajNWwMgrZdiOvyVMyKhrTeq+QybGRqx7kJjlJZpFN5AwsrbX7+8gU2GmmEtNkpaQF7iKLkAS6KzkLe07vaCyWHNnojZVSyGlXQ8ge2LNDtlrfOiSbpyZ+nqyJrqXUj7yDNbP4YltYpiijJD1I37OUitSarEKhrX6PIU/IXVj6X4UFze0H5RRyOpY2T/NWRL+L2SqTtyMJkmIwDt6alSEXyAvYDksKxCGyFoUOZpXmrfAHHSngCpSyRp9xlmVVMae1Xm3MdGcsZCs7tQmV1DBY9ihI38h8x64qez6Sr+Q5bCf1XqDJahocV4NgfUjzrkDxdyj1Nh0GWRVyWhqApLRihWyVKfeR/GVSNs2B2T1EUjkYS77DJqltqdk9hr1fqK9VkjcIN2ottDZ60BLYRrt8QnJIXCPtYCfVgegeV+NhrwW/5h1MvsBOLl9NUOhIVumNVJmonuVKfUbpfIuMgL2E6lML12dWFQtQSCFbbZb6jy+t7w7s5bFKamhKf99YgdOJ5juYVUrRxf5gJAVd5XQDlr1KdfWh6pS0nNbGap3lpMz0bZXdD5Duk3r+AnKCNHDG0Z/cgx3r6v4KmI71Gv0v+YPSetTPVALxySNekb2OXSy1D5VVbKcGfB1WYtokHfPvyWYyF+b/ZdJBN/vSDboxvrmuSBWi9jIN9i5YnSzOlStXrly5/mP9BPBTqButsB/lAAAAAElFTkSuQmCC
[image15]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAYCAYAAACiNE5vAAAC2ElEQVR4Xu2XTYhOURzGH6F8DpqQImNjoYSMkSkWkpRIaULZSCRiMpNkZj0LSlM+NoisCCnJ2is1JGFh5WNBNoiFkNTgefrf45575tz3vd7k1cx96td933NO9/6/zv/cC5QqrLnkOJkYTgxnjSUXSIVMyk4Nb20gJzDCHFeJ7ycb0VjHO0g77PmjyAyynSz2FwWaAqvUheFELY0hnbCHKOsVNMZx2XGF/Ay4CnMuJgXnCPlClgZzNbUuQWqk49I58pS8JtfIejI6syKr5eQj6nB8AjlP7sAcfkG+wqLcnC6rKgVJaxX9ahoXDkR0EsUdUBWcJWdQwPGZsKyugnXxUIdRPON68GWkJfmObEM8Q5PJvnAwoqKOK8hdZDPM5lzH55P75BLZSnphWR3vrdlJHpL3sLN8qjcXSg8+SnYhDeA8ch32nAXJmJMM7AnGYjpF+skj8obcI0syK0xtMBv17FzHF8GcURNw5Tid3IJVQD2aRg5iaHnr/2rynDyGlWEFFozZ6bJcqTvLTlc16ujaw3LUSZWm+7Yk/6OOK6M3YdFTRiQ5e5ocwlDDi0r3bQkHPSkTCoCyrGtsW8WkLeFvFQVLtqtS1fVlrwKuY88p6riy/Yl8h3VKRf5Ysqhep321wva57qsjsSk7/VtqbOrQf6pZ5BV5CUuYyt6VuFPU8TXkRzL5t6WXnWfkAKxvXCRvEW9wc1B7j++A2brHG3OOC/3WnBLo8xlpc70Lex/BMtjxpE4eSkdZaGBR6SNGlRMeeSrNG+QBWQkzVlcZpGs1KTlywHfclXoF+SdNNONqBCrDPn8QFhDtm9DwolLZ7Q4HEymYKmt1ZGVQLyTa57W21gpYV/fLeAv5BjsV8qRKUnLlU0Z6z30CO77UDRUIHRn/26enAtNNbsOOVn0wfSB7k7lQ2sYqb/ceMUgGkJS6k7KgAVFvef8rqR9sImuR/45eqlSpUqVGjH4BnwCLktxokb8AAAAASUVORK5CYII=
[image16]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACDUlEQVR4Xu2XPUgcQRiGvxAFg/8RPEQhJkXEyiIkNoKiFrGwEZPGOrEMprESC7EVlFQhJIWFP1iLhaWFEAhYCQHhEH+wSIqgaQLq+97scnOzO+ucsnsG5oGH2/125m6+b2dn50Q8Ho8nyiA8gIeODqtumdIAP8DPcAa2lV6+kYfwLew04gUewE9wTVQDnpMv8BK+Ds75Jf0wD18Gsax4AvfgO1gDR+BP+EpvFMMjOAoX4TG8gC9KWgTk4Dps1WLN8LuohNu1eB1chh1aLG2qRN2QjeA4ZB5uiUrUBq+xYANwVhKKwKk9ZcR64B+J/jCLswTrtVjaPIOncNqIj0lCUjGwv7X9G/jciE3AK4n+cAt8L8VHJgt4k/hYmmPhNOcYOVYXEosQB6ffP9hnXqgAYbK2IphxG2UVwbYeuPBY1HNqvk2S5EqfBAcfl2yqRWAjNjbXg0rxUeKTTbUItvWgUtiStcVtOBeBC943uf16wP5cPLmRcbWp0NMOx8HxmMmGReBbwgXnItxlPSDVcAiOl2FvoacdjiMv6tWsMwl/wW4tlhN1E+JwLsJ9Ww8IZ9cc3IWNQYzF5gZvRYrj7IJn8Ag+DWI6LMJfsex2uUf4AX+Lml6h53BfHCqXAUx+U9TWnjvAr3BHSneuPObWeluKxaqFqxLN7QQuBG3+K/jfhTeEjxA/ee7xeDweT0pcA5lCg01kjkRXAAAAAElFTkSuQmCC
[image17]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABgklEQVR4Xu2UPyhFYRjGH0n5lz/5lyJRlFKUmGSySWFhsFkNSkIWJRGDyaK7GGRQKJkMNhllsJiIyWYwGPA8ve917znucI9zBsN96te97/t953u/+5ynC/wT1ZB50kM6yQxp9bViMkE2ySwp834kNZNH8kVeyBQp8rUFsuy1+jtZa3lLA9bDTaqWXJJ+r7XvmnT87MhTelAWDJExUuX9bvKA4IB73xdJevAM5r+4IG2wg5/8M71PVuoSf5b8PSRrSHDAKEmRSq8PnBZyh+AA1QNe51QT7AbDpMR7it+W16Uwi+ZgkTxBxnO9kytS73VAXeSGHJFpskqOYYfUkV0yDkuTLKq2xzBITkkv2SeT3g9Ii69kBZkMN8Buql8k6fb6rmHhnOtXyZ60hQHphufkmbR7TwftkUX8PiyydPs38gFLhGzahr242IdLI+STLIUXkpIi9Y7c2S2H/ZnFktIgWzZCfQ1WovRSY6uP3MJiqahpoGJZkb0prmRFoxPbloIKSk7f4eA5+6uwssIAAAAASUVORK5CYII=
[image18]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABb0lEQVR4Xu2UPyiFURjGH6H8K+RfJjEogygxyWSwUCzsZhkkZJYiKWUxMBoUg0wG1yKDQQYLC9lsBoNBnqf3vc79vm5x7/cpw33q173v+33fec95z3MO8A/VQbZIrcflZJKsk1lS7fmiVEkOSIbUeW6BLJMyMk02/X9RGic7CAUayTkZ8Oft5Ip0eVyQ1Jo5MoFQoIc8IFrgngx7/GtVkHnSCltFBlZAAz/7r6QCT/5OQRpzpNQL1JB9cgkb+JG8kyPSS+4QLaB40OO8aoPNYATmmriWEFYgSx4j9Fx7ckGaPY6om1yTQzJDVmGzzPW1fH5DXmFnoYEMkRPSR/bI1PfbOdJDfbSC4OEWcgZb0U+qgrUnezYi0gxPyQvp9JwG3SWLSHBostLs38gHzBFq0wZs4xIPLo2ST9jm/YlkKdkun3dlUV1miVQPa8taLK/CclRTLF+U+sktzJaymgpuI1zJqUit0F0jErelpJLS0xcoUjto4/N95QAAAABJRU5ErkJggg==
[image19]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGoAAAAYCAYAAAASy2hdAAAE4ElEQVR4Xu2Za8hlUxjH/3LJbdwvCY1bxAeUkHIpUYRyy7jFBw0lpUzuyRRyz6X4IGGU5J4GoyivSyhyK0YuGRIhPigKufx/59nLWWedfc5ZRzPvvKP9q3/z7rX3efbez7PW8zxrj9Txv2Qb6yxr/WxsbesE63rrHGuD7FzHLLOHtdR6xpqxNs7OLbIus9ayFlg3N393rEaO02CgNrdesPZrjrezXrd2aY47VhNloPa0PtVgoD6yDm6OZxvS7unWPdad1hGK1FxChrhJcR0Zgef+L2xiXaiwc5Xa7ZBdDlQ8z93WMWp/phpb1ZSBIkBfNf8Cxr9UXDfbbGo9aS20drWutv60ljXnEidZT1j7WIdY71q/Wydm19Qw33pfcT9q9tHWJ9YB2TUE6RLrZWtna0vrIUUw1s2uq7E1FXM5UBdYDypmJuCka6y/rUubsW2tVxUrLdXR3axvFJlhx2ZsEutY91qPN38nrrOeV7+hwi/faTDDUBbw0VHNca2tqSgDtYP1gQYDxfH+zXENmzUaB05drxwsWKIIykXZGM/xq/WitZHiOX+xPlcEDbDNLOe3zOQacPa36k+ABKsS+8kfOJug5GlsnmKy3K+4d62tIXgBAnKoBpcnlIEi2qSbNGOoWS9ZWzXH4yDINB44CC23Dld7x8i1Z5aDBcdbH1pHZmMpMDOKZyYFkvZwUt65piDXZgJW5F8adi6/x84ZihT2rIYDxX1nrLcUzViNrQF2t960HrZOta60HlMEgxl/g/WG4sVJMfvGz3p59ClFzif31uR6bD6gmMEUVoKzt+L+BJ7AJDh3saL1nxZekpe9tTyRgbNwGimKJqOG5MRRzmU8BWRUoNJ4ja1/wck/WJerP6O3VsyIlCLGwezhpvksHQfL/exyUBG006wfFS9D4Cn2j2qwIaiB619RFOX5xbkcJgBNB0W/bTW3gfOGnKhB56Z6PSlQNbZ6MLuXWl8rOhMgOHcpZnLtw08DTty+HMygnvCgVyjSV1s7Ow6eGcd/pkjHoyCAy63FGk7z46AOTnIuPqQWTgpUja0erKafFS0qHRzphz0GDloVQUpgm86HzoZiz/5nVIdDW3tYOTgGWnAK9k7FeA6ThYzB3mXaiTDkxJbxMiCJcrzGVo9RxWxVs8h6W/F9kFqyzPpY7Q0Fk4braiBI2NqiOcYxqbgnUpAWqH8vmqdUdydB8/SHhn2WnEudptWm5R4VKCbSPNXZ6pFaWE6UbKjpZ1sNpAVWbZlu9rLesZ5WrHRekAd9TbHfmQSNDa12Xs9IfXeoHxDuebuGm55rNbitGLdtIG2vUHxtyDlPUV9TusX5+THQEdOdpt/W2uq9FOmOnj+Hh6YDJO2sbAjCseVgA+mPL/SsLlY6DQEBnAQvRE36XpHCk35S/90I0mLrt+Ia6vMK9b9R0v3RBeZ1O4egs5nGb2lSYJumB5+ljSuTCxt00Qm+hvCMBzXHtbZ6sOTfU7TjdFr86DZFUV9TWKJIFW1Ke5G0ryrPo7SvAbYHfNJhorRlGsCpz1mPKLYZ9ylWfr61AFbuF9a5ik6Xb6HnazC919rqQYrj/5vQqkh3ayILNf5rBX4i+Cc3/47yG1mJgKNRGarWVkcBKecWtae+jjkEW4cbNdyBdswhWE2naPqvIR0dHR0dK49/AHn1IQ6xcJMCAAAAAElFTkSuQmCC
[image20]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACaUlEQVR4Xu2XO2gUURSGf9GAosZHQBEjPhDFSiHGNAFBJcRCER8gWsc0gmhhKiEQLLQMqYJEgkiI2CqCFilSiIJgo6CIQQSxMEXQSqL5/7kz7tk7c3dWJbsK94OP7JyZuzvn3Dt3ToBIJBLJc4i+ox/q9Igb1lBa6SU6Sq/RTdWna7Kb3oQbe46uqD4NLKEjdJJuS4/FLfqD9qbHS+lBOkM701ij2Epf0j66nB6lb+gBe1GAU/QV3UdX0SH6mK6xF22k9+gGE1tHn8MlvNnE9SV3aLuJLTbL4Cbkfvo54zp9hIJZNWyhb+l5E8tyu2hiydK+bANkL51D/of1BcN0tYktNjvoJzrgxU/Sb7TDi1uUvH+NVvpdOgU3qQln6K7sIEWDfyL/w230AiqPTCPQJOmx9O/lGNw92ln20YT5RRDjcIVVgYNo+X2n3f6JJpAlGyqCH7co2VARiuK/CO0H9bAe7jn13ya11E5fCyVZlGxZEbTUp1CcbGkRdEIX+PtBs7iC4mTLirCSPkFxsqVFCO0HzSKUbChuCSUbiidow7uNP98PNF6bpxqZel2bjAyj+9D9+MlmRdBbIoReo0XJqggfEXjV/81+IFroYXr6N+xKRobRfczA7fSWfvqF7jEx9TyahIzjdB7VHa6arQep+pzjX9sPhFaXurynqHR5KrYavAlU7lOt8We4Gd6exlSQZ3QwPRY74a45a2JJj/CCzsItr8yv9DXyS6kZKPmHcK29WuYxOo3q5azPaq21GdqWeD99T6/CrTyt9Btwhfzv0P8umhAlor86rhe9KXroCbhWOhKJRCKREhYAwtSR8KGKkccAAAAASUVORK5CYII=
[image21]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACUUlEQVR4Xu2XT0gVURTGv7AgSYkIkkihImpXRkUbIQgRDYqggqi9tGjTpsBVEBG6FCPIIkJc+GeZtEjwka0Kgja1iOgRkbRpEbUKre97d6Z35zrTvPtmtM39wQ+cc2fezD1z5twrEAgEAqs5ST/QTw3aay77LxymfW4whwN0hN6nl2hrchjYQMfoFN0dHYsHdIX2R8ct9ASt0mNRbL04Tq/TV/Q3vZEc/ifn6FvaTdvoLfqMbrVP6qDTdIcV2wZzwyrdZcX1IxO004q5bI4sEyXhND1Ff6LxJHTR9/SyFYvndtWK1Ur7mh0gh+h3Oks3WnH9wChtt2Iue2EyPUy3O2NFOQK/JGjyOl/XxajSJ2kF5qXWuED3xwcRujit7DSpQdQ/mSw0fpA+pQ/pnuRw0/gmQS/MTYJ4TJdgXlgm6ge/aI870ARqSjOR+rsIvknQZLOSkBb/S1Y/KIqqQVXxHOYbz6umNHySoFKvIH2yuUmIb+T2g7LYSe+iuWT4JGELnUf6ZHOTkNUPykS95R59AbMsN4pPEkTWZLPiNfRWHqG8fuCiKtCeZAH+VSB8k3Ab6ZNVEj4jY6lfy34wTp/ArBq+k4/JS0IHksvyGbqM5A5Xe5i5yNT9TJn9QBMte5mMn2/IHYBZeb7CvOH4XkrIS3ozOhb7YM65aMVqe4TX9BtML4j9Qd9hdSnlocmr1FXyKn19AkW5Qr8g+Xx63kXUd7oq7TcwzdDeEh+lH2G23edhKl0buU3WOaUzQO+g/N1iEbRS6J+uszBb6UAgEAgEcvgDrJOEX+JdnU8AAAAASUVORK5CYII=
[image22]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAYCAYAAAD3Va0xAAABFklEQVR4Xu3TvUoDQRSG4RM0oKQQm1jYpIiCYGdrY0jhJUSMVxCwFbEJWNgLdvY2NoLeQ34KGyGVoI1FglpZhfy8h5lhZyfBSfr94GHZOcPumcOuSJZlc4QBJp4fnHl7roP6EwpePZV7jFENC2QHbdSxFtRS2UQXH9hOl6SCZ5SC9bnZwzdeJHnjCs5xg3W7Fs2pmLNf2Hs9/52YOeXcpkVyiyEOsYtXtLDhb4rFzecTDTyIeYgO/tjbF42bzwhXyKMm5qj60NVk6/9x87mUZB5b6OEX+3YtGv1+3Hz8NMW8QK/RuPm8i+nCj3aiHWlnYW0mB/jDo8zOQu91XbvSL3pu9Df4kvT/08eJrRfRCepvKNt6lixTa1A8Ip1plLwAAAAASUVORK5CYII=
[image23]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACBklEQVR4Xu2XzysFURiGP2FHfhUJxYYlEiKlkERKIQs2UpKdFFH+BoWlsrCQH3+AhaIsLJRSykpdkrJgIUopvO89M+65M/eOuYN7bzlPPXXnO+c0c79z5jtnRAwGg8FNB7yCNz7tUsNSQj3sdgY9GIatMAdmwGI4Buv0TmxYg9uw0rom6/Ad9ljXmbAdhmCjFUsWzXAOnsIPOB/dHJcsuCNqjO4uzNP6SYmojsyQTYGoG4ZgmRZnNjdhuRZLBkxCP+yFL+I/CYSTeSFqBe/BPlETGgWX9owjVgufRA1iNm2YnBWYq8WSSYMknoRVUeM84TtT7YiNSuxlVwQnJfLKJJs/S0IsuITeYJuzIcUESQLr3TI8g7fwRFRx9SRePfBDIdwX927i5VJ4pD+CJGEDLkikDnBneIRNXz1iYN/IWQ/SgSBJYP3SCyGLOlfElnj8v3j1IB0IkgQnpfBa1LmIO6MLFjwun6D1gONZPHkjv+aHR/oj0SSMizrrTGkxOwmUv138pB6QbNgJhxKQZwC/fJcEziwnwYb9uKr1JNivw5Goc4+LdK4HxH6+RWcDqIH3ov5glRVrEbU7cHJsRuArHNRi4TMCtw9WTP1o+QwvJeAe+8twJu8k+vn4vMcSOelyhs/hgUSOxHw9Z+EhnBB10HuA01bbv6ICDoj68Ir6ZjAYDAaDITaf6iZ+MhATzvoAAAAASUVORK5CYII=
[image24]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAYCAYAAABN9iVRAAACWElEQVR4Xu2XPWhUQRSFjySCwYDYKBLBBKIiWAiiNiGgWBhCJJAI/vaCYGEjaiOICJJYCCKoIBZBizSBWFmYMn9go6YKqIiCojbaGJJ4zt6dffPuyy5Zm7ew78BHeHdmH+/MvXdmAhQqVKiZdZR8J6sRP8mFaM4tNz5BNkfjeWgXeUG2uXgbOUsekbtkb3p4bT0hK+S4H6B2kxlynmxyY3loI3lKPpIdUXwLeQVLVjs5QN6ToWhORlvJHPlAOtJDOEYmSaeL56lTZAlZ81dhPuQn6BxZINujWEr7yA/yEklmW8hlcgdWSo2iTlhJKyGx+ZDAZ+XnoEPkNznp4hVpddTLWjlJ/fwA1vcbwqQGkMp9lByGmYzNhwR68wfJH3LbxSu6DyujHrKHvCHTsB5qJKl3r8AS4s0Hk9XM+3hJoVz0okvkOcy4Nr8T0bz1qpvMk091cKb0y9rS7v4YSUK8+QFY9XqTNc2HclkmN2CldRr2Ii1EazI1N+mbRsiRKObN9+E/zId+v4akv7Uzaof8RfaXY3lKm1Uo9yBvvprJavGSdL6Hfo91E7Yo+luPdEro4qGPWi86k2vpHrKt8hf2fV9glx0l6SuyJoP56y5e6fdFZM9BvUyZr3lGriGdFP1kuA7UevXKZ14LOIX0cS3p0qaFylzewqqMI9vbelZcq6ubXSNJ5T9GPpOdUVzfqaroKj9rnm57qZNLq6Byie/r35DsuirbWTf+FraT562LsP89wncpqyp7VZw2xofkNRmEGX8Hu+Y2hZRt3VXUTr2wBSlUqFChQk2lf4JcmFMSBbKYAAAAAElFTkSuQmCC
[image25]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAYCAYAAAC4CK7hAAABpklEQVR4Xu2WzytFQRiGP6EovxWJIgtlZSFslMKChY1YWWMpNlZW8g/ISmJhIbK++QMslFJWSqmbjRULsVJ43zNnjjH3zr3Hj3sONU893Xu+OVPfzJlvZkQ8Hk8cRuENvI3puOqWKHVwCW7DNdj2uVmkDG7BQ9gVPpMd+AonwudyOAKzcCCMJUUnvITzsApOwms4aL7UCo9gixFrhOeikm434jVwH3YYsVJTIWpSj8P/mg14Aqt1gMtkOWpW9MFHye3MAW7CWiNWarrhHVy14tPwGfbrwCzsiZoVc/BNcjs3wwX5WH5JwInmErdzmRKVI3N1wk/5AofthhTQCbsGYscjXPURhyZR69be5QrJHagQTDRfwkUHwjXHtWfXR1qsSP6Eiw7EVR9p4UrYFQ9gEe/J9+uD/bkh8LCKa0PQ0w3zYD52wnog3L1y+El9kEo4Bme+4FDQ0w3zyIra9k0W4T3steIBf60+CL/yOjyD9WGME8ZD/ECMPHmGXMAHUZ9K+wSvxDhwUoQDyIi6RvF6sgtPJdkbxq/Bux4nlcuRv3z2eDyef8o7UxhlBJ8c9JwAAAAASUVORK5CYII=
[image26]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAYCAYAAAA20uedAAAAjUlEQVR4XmNgGOQgCYh3A7EwugQHEG+FYhAbBcgA8RMgbkUW5AFiSSAOBeLfQBwBxOJAzAqSjAfiWUB8H4h/AvFSIJ4ExMogSRAg3T4YcAHiX1AaA1QB8XMgVkKXgNm3B4i5GSCu7GKAWMUgAsRXGRD2BQFxARAzgjggohGI7wDxSigb7EdkIADFQxQAAFlmF1Xx4IiWAAAAAElFTkSuQmCC
[image27]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAYCAYAAAC4CK7hAAABzElEQVR4Xu2WPyhFURzHfwZFFHoiZUGRCUk2k4iQ/CmhlMloomySkkwMShkMBpPJRFEWZfZnUEpiYmLAwPd3zz3Xvefe+5zzOIM6n/r07vvdc+t8zzu/cx+Rw+H4T7TALrXoUwjH4RZchQ3R21Gm4SHMqDcs0g7n4Dn8hPPR2x4lJOa1BIthM7yEw+FBkgJ44MvXpqzBJrWoAQfph73wlZKDcI2DloVqE/AKVoZqHtXwHi6rNzTZgK1q0QB+NikIT55D7Cj1NvgCB2SBf6oqOAo/4BiJlPlygCa2gjTCJ4oHkeODhZ8i0UC38A3uwnVYJwdoYiuIrKcFidR/2x+MrSDcP3wIaAUx6Q8OyltRdRt2J9QzMM97MjtpQXrIIEgnfPc/f2KExFZUvYb7CfUVWOo9mZ20IIkTTqsvwEdYGy4aYmtr8Zx4bmlBeO4esj+OYBGJ04rfnLzdTLAVhE/VE4r3b2wXlcML+u6PIThLevs6zF8FCVY4xCS8gzX+d54bv+XPSLz1g+IivIF7/rXpO4TJNcgMfCDR0NJneAor/DE8n014DAdJhODF578qMbghdZoyjVyD6MILXk/isOmg3BZbiz4Sx63D4XDY4wu8pWxWS6I/QgAAAABJRU5ErkJggg==
[image28]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAACYUlEQVR4Xu2XO2tUQRiGX1EhgsYrXkgg3lCsLNTYBIRoYZA0UStto2XQxkosxD+QiIWIFhZBEeyChVWwEARRCAQCQhICoqCCaCUY33e/mc3s5MzuYWV3FeaBh90ze+acuX7zLZDJZDKrGaQf6GJJz1i1ttJNx+h9epPuqf05yVp6jt5zXqAbau4ga+hd+oTuddfiAf1Nz7prPewUnacnXFm76KPv6SjtokN0jvaHNxWwnk7QW/QArP5POgN7ZpVd9CndGZRtpW9gHe4JyjfSx7Q3KGs162AT8sx999yhL1AwqwGawJeo7cNlugx7ZvV5WtrX/IXjKP2O1S/W4IzTTUFZq9lPP9IbUfkIbFaPReUhquM77NEELsG2vxZAhYv0kL9wXIJVjl+8nV7BypZpB5okbcu4LcOwNqqtKY7Td7A2exRLFpx144pG7hcdiH/oAL6zqUGIyxuhPqlvz2HxpZBUPCjDNtg+jU+TeirS18Mv6bizzQyCAuUj+g0Ngqr2mPZaHA86xXUUd7aZQTgPiy8Nj/hUPOgUqc6mylNo5t+ixPGugKfl0mw8UH0FTwWcsm6p1Ezj93DcWT8IOiUaoQF4RQ+6a61wHZWF7/6beCC0507DsrKynqzUTKN2zMOO5pCr9As9EpTpyNMkhPTBtrY+PTtgmWfhUf+vxQOh1XWbvqabXZkGWwneJFbaeZh+guUA+1zZbjpNv6I2GH+G1a/2UTmC9opu1PLy/qCzqJ+MtAt1fgqW2itlfghb3mHmqu9KrZUh+sHyJ0uRyjj/O/TfRROiLaRPXWcymUwm0yL+ANJMj3QMske2AAAAAElFTkSuQmCC
