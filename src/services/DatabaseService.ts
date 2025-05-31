import { PrismaClient } from '@prisma/client';
import { logger } from '../Utils/apiLogger';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Log database queries in development
    if (process.env.NODE_ENV === 'development') {
      this.prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
        logger.debug({
          query: e.query,
          params: e.params,
          duration: e.duration
        }, 'Database Query');
      });
    }

    this.prisma.$on('error', (e: { target: string; message: string }) => {
      logger.error({
      target: e.target,
      message: e.message
      }, 'Database Error');
    });

    this.prisma.$on('info', (e: { target: string; message: string }) => {
      logger.info({
      target: e.target,
      message: e.message
      }, 'Database Info');
    });

    interface PrismaWarnEvent {
      target: string;
      message: string;
    }

    this.prisma.$on('warn', (e: PrismaWarnEvent) => {
      logger.warn({
      target: e.target,
      message: e.message
      }, 'Database Warning');
    });
  }

  async connect() {
    try {
      await this.prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect from database:', error);
      throw error;
    }
  }

  // User operations
  async createUser(data: {
    email: string;
    name?: string;
    password: string;
    role?: 'USER' | 'ADMIN';
  }) {
    return this.prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        apiKey: true,
        isActive: true,
        createdAt: true
      }
    });
  }

  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        sessions: {
          where: { isActive: true },
          select: {
            id: true,
            sessionId: true,
            status: true,
            phoneNumber: true,
            name: true,
            lastSeen: true
          }
        }
      }
    });
  }

  async getUserByApiKey(apiKey: string) {
    return this.prisma.user.findUnique({
      where: { apiKey },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        apiKey: true,
        isActive: true
      }
    });
  }

  // Session operations
  async createSession(data: {
    sessionId: string;
    userId: string;
    phoneNumber?: string;
    name?: string;
  }) {
    return this.prisma.session.create({
      data
    });
  }

  async updateSession(sessionId: string, data: any) {
    return this.prisma.session.update({
      where: { sessionId },
      data
    });
  }

  async getSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
  }

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { lastSeen: 'desc' }
    });
  }

  async deleteSession(sessionId: string) {
    return this.prisma.session.update({
      where: { sessionId },
      data: { isActive: false }
    });
  }

  // Message operations
  async saveMessage(data: {
    messageId: string;
    sessionId: string;
    chatId: string;
    fromMe: boolean;
    fromJid?: string;
    toJid: string;
    messageType: string;
    content: any;
    timestamp: Date;
    quotedMessage?: string;
    metadata?: any;
  }) {
    return this.prisma.message.create({
      data: {
        ...data,
        messageType: data.messageType as any
      }
    });
  }

  async updateMessageStatus(messageId: string, sessionId: string, status: string) {
    return this.prisma.message.updateMany({
      where: { messageId, sessionId },
      data: { status: status as any }
    });
  }

  async getMessages(sessionId: string, chatId?: string, limit = 50, offset = 0) {
    return this.prisma.message.findMany({
      where: {
        sessionId,
        ...(chatId && { chatId })
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Chat operations
  async upsertChat(data: {
    sessionId: string;
    jid: string;
    name?: string;
    isGroup: boolean;
    isArchived?: boolean;
    isPinned?: boolean;
    isMuted?: boolean;
    unreadCount?: number;
    lastMessage?: any;
    metadata?: any;
  }) {
    return this.prisma.chat.upsert({
      where: {
        sessionId_jid: {
          sessionId: data.sessionId,
          jid: data.jid
        }
      },
      update: {
        name: data.name,
        isArchived: data.isArchived,
        isPinned: data.isPinned,
        isMuted: data.isMuted,
        unreadCount: data.unreadCount,
        lastMessage: data.lastMessage,
        metadata: data.metadata,
        updatedAt: new Date()
      },
      create: data
    });
  }

  async getChats(sessionId: string) {
    return this.prisma.chat.findMany({
      where: { sessionId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  // Contact operations
  async upsertContact(data: {
    sessionId: string;
    jid: string;
    name?: string;
    pushName?: string;
    profilePicUrl?: string;
    isBlocked?: boolean;
    metadata?: any;
  }) {
    return this.prisma.contact.upsert({
      where: {
        sessionId_jid: {
          sessionId: data.sessionId,
          jid: data.jid
        }
      },
      update: {
        name: data.name,
        pushName: data.pushName,
        profilePicUrl: data.profilePicUrl,
        isBlocked: data.isBlocked,
        metadata: data.metadata,
        updatedAt: new Date()
      },
      create: data
    });
  }

  async getContacts(sessionId: string) {
    return this.prisma.contact.findMany({
      where: { sessionId },
      orderBy: { name: 'asc' }
    });
  }

  // Webhook operations
  async createWebhook(data: {
    userId: string;
    url: string;
    events: string[];
    secret?: string;
    maxRetries?: number;
  }) {
    return this.prisma.webhook.create({
      data
    });
  }

  async getUserWebhooks(userId: string) {
    return this.prisma.webhook.findMany({
      where: { userId, isActive: true }
    });
  }

  async updateWebhook(id: string, data: any) {
    return this.prisma.webhook.update({
      where: { id },
      data
    });
  }

  async deleteWebhook(id: string) {
    return this.prisma.webhook.update({
      where: { id },
      data: { isActive: false }
    });
  }

  // API Usage operations
  async getApiUsageStats(userId: string, startDate: Date, endDate: Date) {
    return this.prisma.apiUsage.groupBy({
      by: ['endpoint', 'method'],
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: {
        id: true
      },
      _avg: {
        duration: true
      }
    });
  }

  async getDashboardStats(userId?: string) {
    const where = userId ?? { userId: { not: null } } as any;

    const [
      totalSessions,
      activeSessions,
      totalMessages,
      messagesLast24h,
      totalUsers,
      apiCallsLast24h
    ] = await Promise.all([
      this.prisma.session.count({ where: { ...where, isActive: true } }),
      this.prisma.session.count({
        where: {
          ...where,
          isActive: true,
          status: 'CONNECTED'
        }
      }),
      this.prisma.message.count({ where }),
      this.prisma.message.count({
        where: {
          ...where,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      userId ? 1 : this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.apiUsage.count({
        where: {
          ...where,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      totalSessions,
      activeSessions,
      totalMessages,
      messagesLast24h,
      totalUsers,
      apiCallsLast24h
    };
  }

  get client() {
    return this.prisma;
  }
}
