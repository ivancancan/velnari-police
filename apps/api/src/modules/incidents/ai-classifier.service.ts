import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IncidentType, IncidentPriority } from '@velnari/shared-types';

export interface ClassificationResult {
  type: IncidentType;
  priority: IncidentPriority;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  tacticalHints?: string[];
}

// Uses Claude Haiku (fast + cheap, ~$0.001 per classification).
// Falls back to a rule-based classifier when the API key is missing so
// demos and dev still work without external dependencies.
@Injectable()
export class AIClassifierService {
  private readonly logger = new Logger(AIClassifierService.name);
  private readonly client: Anthropic | null;

  constructor() {
    const key = process.env['ANTHROPIC_API_KEY'];
    this.client = key ? new Anthropic({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI classifier falls back to rule-based heuristics',
      );
    }
  }

  async classify(description: string, address?: string): Promise<ClassificationResult> {
    if (!description || description.trim().length < 5) {
      return this.fallback(description ?? '');
    }

    if (!this.client) return this.fallback(description);

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Descripción del operador: "${description.trim()}"${
              address ? `\nUbicación: ${address}` : ''
            }\n\nResponde SOLO con el JSON, sin texto adicional.`,
          },
        ],
      });

      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const parsed = this.parseJson(text);
      if (parsed) return parsed;
      return this.fallback(description);
    } catch (err) {
      this.logger.error(`AI classification failed: ${(err as Error).message}`);
      return this.fallback(description);
    }
  }

  private parseJson(text: string): ClassificationResult | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const type = String(raw['type'] ?? '').toLowerCase();
      const priority = String(raw['priority'] ?? '').toLowerCase();
      const validTypes = Object.values(IncidentType) as string[];
      const validPriorities = Object.values(IncidentPriority) as string[];
      if (!validTypes.includes(type) || !validPriorities.includes(priority)) return null;

      return {
        type: type as IncidentType,
        priority: priority as IncidentPriority,
        confidence: (['high', 'medium', 'low'].includes(String(raw['confidence']))
          ? raw['confidence']
          : 'medium') as ClassificationResult['confidence'],
        reasoning: String(raw['reasoning'] ?? ''),
        tacticalHints: Array.isArray(raw['tacticalHints'])
          ? (raw['tacticalHints'] as string[]).slice(0, 4)
          : undefined,
      };
    } catch {
      return null;
    }
  }

  // Rule-based fallback — keyword heuristics for Spanish incident descriptions.
  // Intentionally simple; real AI path handles nuance.
  private fallback(description: string): ClassificationResult {
    const d = description.toLowerCase();
    let type: IncidentType = IncidentType.OTHER;
    let priority: IncidentPriority = IncidentPriority.MEDIUM;

    if (/\b(arma|disparo|balea|balacera|tirote|pist|cuchill)\b/.test(d)) {
      type = IncidentType.ASSAULT;
      priority = IncidentPriority.CRITICAL;
    } else if (/\b(rob|asalt|atraco|atracador)\b/.test(d)) {
      type = IncidentType.ROBBERY;
      priority = IncidentPriority.HIGH;
    } else if (/\b(golpe|pelea|riña|agred|lesion|violenc)\b/.test(d)) {
      type = IncidentType.ASSAULT;
      priority = IncidentPriority.HIGH;
    } else if (/\b(choque|accident|volcad|tráns|semáf|atropell)\b/.test(d)) {
      type = IncidentType.TRAFFIC;
      priority = IncidentPriority.MEDIUM;
    } else if (/\b(ruid|música|fiesta|escándal)\b/.test(d)) {
      type = IncidentType.NOISE;
      priority = IncidentPriority.LOW;
    } else if (/\b(violencia intrafamiliar|domést|pareja|esposo|esposa|hij)\b/.test(d)) {
      type = IncidentType.DOMESTIC;
      priority = IncidentPriority.HIGH;
    } else if (/\b(desapareci|extravi|perdid|niño|niña|menor)\b/.test(d)) {
      type = IncidentType.MISSING_PERSON;
      priority = IncidentPriority.CRITICAL;
    }

    return {
      type,
      priority,
      confidence: 'low',
      reasoning:
        'Clasificación por palabras clave (sin IA). Revisa antes de confirmar.',
    };
  }
}

const SYSTEM_PROMPT = `Eres un analista operativo de un centro de mando policial en México. Tu trabajo es clasificar descripciones de incidentes que los operadores capturan en texto libre y devolverlas estructuradas.

Categorías de tipo (IncidentType):
- robbery: robo, asalto, hurto, atraco
- assault: agresión, riña, pelea, lesiones, uso de arma
- traffic: accidente vial, choque, atropellamiento
- noise: ruido, fiesta, escándalo vecinal
- domestic: violencia intrafamiliar
- missing_person: persona extraviada, desaparecida, menor sin ubicar
- other: cualquier cosa que no encaje claramente

Prioridades (IncidentPriority):
- critical: riesgo inminente de vida (armas, disparos, menor extraviado, rehén)
- high: violencia activa, robo en proceso, lesionados
- medium: evento con víctimas pero estabilizado
- low: queja sin riesgo físico inmediato

Responde ÚNICAMENTE con un objeto JSON con este shape (sin markdown, sin explicación extra):
{
  "type": "<categoría>",
  "priority": "<prioridad>",
  "confidence": "high|medium|low",
  "reasoning": "<1-2 frases en español explicando por qué>",
  "tacticalHints": ["<hint 1>", "<hint 2>"]
}

tacticalHints son sugerencias cortas (3-7 palabras cada una) para el operador: "Enviar 2 unidades", "Alertar a paramédicos", "Resguardar perímetro". Máximo 3.

Si la descripción es ambigua, usa confidence="low" y sé conservador con prioridad. Nunca inventes detalles que no estén en la descripción.`;
