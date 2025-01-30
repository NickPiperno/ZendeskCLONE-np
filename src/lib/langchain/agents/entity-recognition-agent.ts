import { BaseAgent, ChatModel, RAGContext } from '../types';
import { z } from 'zod';

// Define UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_REF_REGEX = /^(?:TK[-])?(\d+)$/i;  // Matches TK-123 or just 123
const KB_REF_REGEX = /^(?:KB[-])?(\d+)$/i;      // Matches KB-123 or just 123

// Define entity types and categories
const entityCategories = {
  tickets: ['TicketID', 'Status', 'Priority'],
  users: ['UserID', 'AgentID', 'CustomerID', 'TeamID'],
  kb: [
    'ArticleID',
    'ArticleTitle',
    'ArticleCategory',
    'ArticleTag',
    'ArticleVersion'
  ],
  topics: [
    // Issue Categories
    'Authentication',
    'Billing',
    'Performance',
    'Security',
    'Integration',
    'Data',
    'UI/UX',
    'API',
    // Product Areas
    'Frontend',
    'Backend',
    'Database',
    'Infrastructure',
    // Problem Types
    'Bug',
    'Feature_Request',
    'Question',
    'Configuration',
    // Support Levels
    'L1_Support',
    'L2_Support',
    'L3_Support',
    // KB Categories
    'How_To',
    'Troubleshooting',
    'Best_Practice',
    'Reference',
    'FAQ'
  ],
  metadata: ['Date', 'Time', 'Location', 'Version']
} as const;

// Define entity schema with UUID validation
const entitySchema = z.object({
  type: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.any()).optional(),
  normalizedValue: z.string().optional() // For normalized UUIDs and references
});

// Define grouped entities schema
const groupedEntitiesSchema = z.object({
  tickets: z.array(z.object({
    id: z.string(),
    confidence: z.number(),
    status: z.string().optional(),
    priority: z.string().optional()
  })),
  kb: z.array(z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    version: z.string().optional(),
    confidence: z.number()
  })).optional(),
  topic: z.object({
    name: z.string(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
    problemType: z.string().optional(),
    supportLevel: z.string().optional(),
    kbType: z.enum(['How_To', 'Troubleshooting', 'Best_Practice', 'Reference', 'FAQ']).optional(),
    confidence: z.number(),
    tags: z.array(z.string()).optional()
  }).optional(),
  users: z.array(z.object({
    id: z.string(),
    type: z.enum(['agent', 'customer', 'team']),
    confidence: z.number()
  })),
  priority: z.string().optional(),
  context: z.any() // RAG context
});

type Entity = z.infer<typeof entitySchema>;
type GroupedEntities = z.infer<typeof groupedEntitiesSchema>;

interface ProcessInput {
  text: string;
  context?: RAGContext;
}

export class EntityRecognitionAgent implements BaseAgent {
  name = "Entity Recognition Agent";
  description = "Recognizes and validates entities in user input";
  private confidenceThreshold = 0.7;

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: string): Promise<string> {
    try {
      console.group('🔍 Entity Recognition Agent');
      console.log('Input Query:', input);

      // Extract entities using LLM
      const entities = await this.recognizeEntities(input);
      console.log('Recognized Entities:', entities);

      // Validate and format entities
      const validatedEntities = await this.validateEntities(entities);
      console.log('Validated Entities:', validatedEntities);

      // Group entities by type
      const groupedEntities = await this.groupEntities(validatedEntities);
      console.log('Grouped Entities:', groupedEntities);

      console.log('Final Output:', JSON.stringify(groupedEntities));
      console.groupEnd();
      return JSON.stringify(groupedEntities);
    } catch (error) {
      console.error('Entity recognition failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  async recognizeEntities(input: string): Promise<Entity[]> {
    try {
      const response = await this.llm.invoke(
        `Extract entities from the following text. Return only entities with high confidence in JSON format.
         Pay special attention to status transitions (e.g., "from X to Y") where Y is the target status.
         Consider all possible entity types across tickets, users, and topics.
         For IDs, extract both reference format (TK-123) and UUID format.

         For status changes like "change from X to Y", extract:
         - The target status (Y) as the main status entity
         - The source status (X) as metadata

         Text: ${input}
         
         Entity Categories:
         ${Object.entries(entityCategories)
           .map(([category, types]) => `${category}: ${types.join(', ')}`)
           .join('\n')}
         
         Return format:
         {
           "entities": [
             {
               "type": "entity type from categories",
               "value": "extracted value",
               "confidence": number between 0 and 1,
               "metadata": { 
                 "format": "optional format info",
                 "subType": "optional subtype",
                 "fromStatus": "for status changes, the original status",
                 "toStatus": "for status changes, the target status"
               }
             }
           ]
         }

         Example for "Change Backup Strategy Review ticket from open to in progress":
         {
           "entities": [
             {
               "type": "ticket_title",
               "value": "Backup Strategy Review",
               "confidence": 0.95
             },
             {
               "type": "status",
               "value": "in_progress",
               "confidence": 0.95,
               "metadata": {
                 "fromStatus": "open",
                 "toStatus": "in_progress"
               }
             }
           ]
         }`
      );

      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const result = JSON.parse(content) as { entities: Entity[] };
      
      // Process and normalize entities
      const processedEntities = result.entities
        .filter(entity => entity.confidence >= this.confidenceThreshold)
        .map(entity => this.normalizeEntity(entity));

      return processedEntities;
    } catch (error) {
      console.error('Entity recognition failed:', error);
      throw new Error('Failed to recognize entities');
    }
  }

  private normalizeEntity(entity: Entity): Entity {
    const { type, value } = entity;

    // Handle different ID formats
    switch (type) {
      case 'TicketID':
        if (UUID_REGEX.test(value)) {
          return { ...entity, normalizedValue: value.toLowerCase() };
        }
        const ticketMatch = value.match(TICKET_REF_REGEX);
        if (ticketMatch) {
          return {
            ...entity,
            normalizedValue: ticketMatch[1],
            metadata: { ...entity.metadata, format: 'reference' }
          };
        }
        break;

      case 'ArticleID':
        if (UUID_REGEX.test(value)) {
          return { ...entity, normalizedValue: value.toLowerCase() };
        }
        const kbMatch = value.match(KB_REF_REGEX);
        if (kbMatch) {
          return {
            ...entity,
            normalizedValue: kbMatch[1],
            metadata: { ...entity.metadata, format: 'reference' }
          };
        }
        break;

      case 'UserID':
      case 'AgentID':
      case 'CustomerID':
      case 'TeamID':
        if (UUID_REGEX.test(value)) {
          return { ...entity, normalizedValue: value.toLowerCase() };
        }
        break;
    }

    return entity;
  }

  private async groupEntities(entities: Entity[], context?: RAGContext): Promise<GroupedEntities> {
    const grouped: GroupedEntities = {
      tickets: [],
      kb: [],
      users: [],
      topic: undefined,
      priority: undefined,
      context: context || {}
    };

    // Group entities by category
    for (const entity of entities) {
      const value = entity.normalizedValue || entity.value; // Use normalized value if available
      
      switch (entity.type) {
        case 'TicketID':
          grouped.tickets.push({
            id: value,
            confidence: entity.confidence,
            ...(entity.metadata?.format && { format: entity.metadata.format })
          });
          break;
        case 'UserID':
        case 'AgentID':
        case 'CustomerID':
        case 'TeamID':
          grouped.users.push({
            id: value,
            type: this.mapUserType(entity.type),
            confidence: entity.confidence
          });
          break;
        // Enhanced topic handling
        case 'Authentication':
        case 'Billing':
        case 'Performance':
        case 'Security':
        case 'Integration':
        case 'Data':
        case 'UI/UX':
        case 'API':
          grouped.topic = {
            name: value,
            category: this.mapTopicCategory(entity.type),
            confidence: entity.confidence,
            tags: entity.metadata?.tags || []
          };
          break;
        case 'Frontend':
        case 'Backend':
        case 'Database':
        case 'Infrastructure':
          if (grouped.topic) {
            grouped.topic.subCategory = value;
          } else {
            grouped.topic = {
              name: value,
              category: 'Product_Area',
              confidence: entity.confidence
            };
          }
          break;
        case 'Bug':
        case 'Feature_Request':
        case 'Question':
        case 'Configuration':
          if (grouped.topic) {
            grouped.topic.problemType = value;
          } else {
            grouped.topic = {
              name: value,
              category: 'Problem_Type',
              confidence: entity.confidence
            };
          }
          break;
        case 'L1_Support':
        case 'L2_Support':
        case 'L3_Support':
          if (grouped.topic) {
            grouped.topic.supportLevel = value;
          }
          break;
        case 'Priority':
          grouped.priority = value.toLowerCase();
          grouped.tickets = grouped.tickets.map(ticket => ({
            ...ticket,
            priority: value.toLowerCase()
          }));
          break;
        case 'Status':
          grouped.tickets = grouped.tickets.map(ticket => ({
            ...ticket,
            status: value.toLowerCase()
          }));
          break;
        // KB article handling
        case 'ArticleID':
          if (!grouped.kb) grouped.kb = [];
          grouped.kb.push({
            id: value,
            confidence: entity.confidence,
            ...(entity.metadata?.format && { format: entity.metadata.format })
          });
          break;
        case 'ArticleTitle':
          if (!grouped.kb) grouped.kb = [];
          const existingArticle = grouped.kb.find(a => !a.title);
          if (existingArticle) {
            existingArticle.title = value;
          } else {
            grouped.kb.push({
              title: value,
              confidence: entity.confidence
            });
          }
          break;
        case 'ArticleCategory':
          if (!grouped.kb) grouped.kb = [];
          grouped.kb = grouped.kb.map(article => ({
            ...article,
            category: value
          }));
          break;
        case 'ArticleTag':
          if (!grouped.kb) grouped.kb = [];
          grouped.kb = grouped.kb.map(article => ({
            ...article,
            tags: [...(article.tags || []), value]
          }));
          break;
        case 'ArticleVersion':
          if (!grouped.kb) grouped.kb = [];
          grouped.kb = grouped.kb.map(article => ({
            ...article,
            version: value
          }));
          break;
        case 'How_To':
        case 'Troubleshooting':
        case 'Best_Practice':
        case 'Reference':
        case 'FAQ':
          if (grouped.topic) {
            grouped.topic.kbType = entity.type as any;
          } else {
            grouped.topic = {
              name: value,
              category: 'Knowledge_Base',
              kbType: entity.type as any,
              confidence: entity.confidence
            };
          }
          break;
      }
    }

    return groupedEntitiesSchema.parse(grouped);
  }

  private mapUserType(entityType: string): 'agent' | 'customer' | 'team' {
    switch (entityType) {
      case 'AgentID':
        return 'agent';
      case 'CustomerID':
        return 'customer';
      case 'TeamID':
        return 'team';
      default:
        return 'customer'; // default to customer for unknown types
    }
  }

  private mapTopicCategory(entityType: string): string {
    // Map entity types to broader categories
    const categoryMap: Record<string, string> = {
      'Authentication': 'Security',
      'Billing': 'Business',
      'Performance': 'Technical',
      'Security': 'Security',
      'Integration': 'Technical',
      'Data': 'Technical',
      'UI/UX': 'User_Experience',
      'API': 'Technical'
    };
    
    return categoryMap[entityType] || entityType;
  }

  private async validateEntities(entities: Entity[]): Promise<Entity[]> {
    return entities.map(entity => {
      try {
        // Validate entity structure
        const validatedEntity = entitySchema.parse(entity);

        // Additional validation based on entity type
        switch (validatedEntity.type) {
          case 'TicketID':
            if (!UUID_REGEX.test(validatedEntity.value) && !TICKET_REF_REGEX.test(validatedEntity.value)) {
              validatedEntity.confidence *= 0.5; // Reduce confidence for non-standard formats
            }
            break;

          case 'ArticleID':
            if (!UUID_REGEX.test(validatedEntity.value) && !KB_REF_REGEX.test(validatedEntity.value)) {
              validatedEntity.confidence *= 0.5;
            }
            break;

          case 'UserID':
          case 'AgentID':
          case 'CustomerID':
          case 'TeamID':
            if (!UUID_REGEX.test(validatedEntity.value)) {
              validatedEntity.confidence *= 0.5;
            }
            break;

          case 'Status':
            const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
            if (!validStatuses.includes(validatedEntity.value.toLowerCase())) {
              validatedEntity.confidence *= 0.7;
            }
            break;

          case 'Priority':
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            if (!validPriorities.includes(validatedEntity.value.toLowerCase())) {
              validatedEntity.confidence *= 0.7;
            }
            break;
        }

        // Filter out entities below confidence threshold after validation
        return validatedEntity.confidence >= this.confidenceThreshold ? validatedEntity : null;
      } catch (error) {
        console.warn('Entity validation failed:', error);
        return null;
      }
    }).filter((entity): entity is Entity => entity !== null);
  }
} 
