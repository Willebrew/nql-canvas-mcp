/**
 * Consolidated MCP Tool Definitions — 16 student-focused tools
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

const credentialProps = {
  baseUrl: { type: 'string', description: 'Canvas instance URL (e.g., https://canvas.instructure.com)' },
  apiKey: { type: 'string', description: 'Canvas API key' },
};

export const canvasTools: MCPTool[] = [
  // 1. get_courses
  {
    name: 'get_courses',
    description: 'Get course information: list favorite courses, course details, syllabus, or settings',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'details', 'syllabus', 'settings'],
          description: 'Action: list (favorite courses), details (single course), syllabus, settings',
        },
        courseId: { type: 'number', description: 'Course ID (required for details/syllabus/settings)' },
      },
      required: ['baseUrl', 'apiKey', 'action'],
    },
  },

  // 2. get_assignments
  {
    name: 'get_assignments',
    description: 'Get assignments: list all, get details of one, or list assignment groups',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'details', 'groups'],
          description: 'Action: list (all assignments), details (single assignment), groups (assignment groups)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        assignmentId: { type: 'number', description: 'Assignment ID (required for details)' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 3. get_grades
  {
    name: 'get_grades',
    description: 'Get grade information: summary enrollments, detailed assignment grades, submissions, or your own grades across courses',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['summary', 'detailed', 'submissions', 'my_grades'],
          description: 'Action: summary (enrollment grades), detailed (per-assignment), submissions (submission data), my_grades (your grades across all courses)',
        },
        courseId: { type: 'number', description: 'Course ID (required for summary/detailed/submissions)' },
        assignmentId: { type: 'number', description: 'Assignment ID (optional, narrows submissions to one assignment)' },
      },
      required: ['baseUrl', 'apiKey', 'action'],
    },
  },

  // 4. get_modules
  {
    name: 'get_modules',
    description: 'Get module information: list modules, items in a module, or full course structure',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'items', 'structure'],
          description: 'Action: list (all modules), items (items in one module), structure (formatted course structure)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        moduleId: { type: 'number', description: 'Module ID (required for items)' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 5. get_pages
  {
    name: 'get_pages',
    description: 'Get page information: list pages, page content, front page, or page details/metadata',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'content', 'front_page', 'details'],
          description: 'Action: list (all pages), content (page body), front_page, details (metadata)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        pageUrl: { type: 'string', description: 'Page URL slug (required for content/details)' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 6. get_announcements
  {
    name: 'get_announcements',
    description: 'Get announcements for a course or across all courses',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        courseId: { type: 'number', description: 'Course ID (optional — omit for all courses)' },
      },
      required: ['baseUrl', 'apiKey'],
    },
  },

  // 7. get_discussions
  {
    name: 'get_discussions',
    description: 'Get discussion topics: list all, topic details, entries, or full topic with replies',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'details', 'entries', 'with_replies'],
          description: 'Action: list (all topics), details (single topic), entries (top-level entries), with_replies (topic + entries + nested replies)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        topicId: { type: 'number', description: 'Discussion topic ID (required for details/entries/with_replies)' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 8. get_calendar
  {
    name: 'get_calendar',
    description: 'Get calendar events or upcoming events',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['events', 'upcoming'],
          description: 'Action: events (calendar events with optional filters), upcoming (your upcoming events)',
        },
        courseId: { type: 'number', description: 'Filter by course ID (optional, events only)' },
        startDate: { type: 'string', description: 'Start date ISO string (optional, events only)' },
        endDate: { type: 'string', description: 'End date ISO string (optional, events only)' },
      },
      required: ['baseUrl', 'apiKey', 'action'],
    },
  },

  // 9. get_todos
  {
    name: 'get_todos',
    description: 'Get to-do items, upcoming assignments across courses, or missing submissions',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'upcoming_assignments', 'missing'],
          description: 'Action: list (Canvas to-do items), upcoming_assignments (due soon across all courses), missing (missing submissions)',
        },
        daysAhead: { type: 'number', description: 'Number of days to look ahead (default 7, upcoming_assignments only)' },
      },
      required: ['baseUrl', 'apiKey', 'action'],
    },
  },

  // 10. get_quizzes
  {
    name: 'get_quizzes',
    description: 'Get quizzes or quiz submissions for a course',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'submissions'],
          description: 'Action: list (all quizzes), submissions (submissions for a quiz)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        quizId: { type: 'number', description: 'Quiz ID (required for submissions)' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 11. get_files
  {
    name: 'get_files',
    description: 'Get files: list course files or get details of a specific file',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'details'],
          description: 'Action: list (all files in course or folder), details (single file)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        fileId: { type: 'number', description: 'File ID (required for details)' },
        folderId: { type: 'number', description: 'Folder ID (optional, narrows list to folder)' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 12. get_people
  {
    name: 'get_people',
    description: 'Get people in a course: users, sections, enrollments, or groups',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['users', 'sections', 'enrollments', 'groups'],
          description: 'Action: users (course roster), sections, enrollments, groups (course groups)',
        },
        courseId: { type: 'number', description: 'Course ID' },
        enrollmentType: { type: 'string', description: 'Filter users by enrollment type (e.g., student, teacher). users action only.' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 13. get_profile
  {
    name: 'get_profile',
    description: 'Get your Canvas profile, dashboard cards, activity stream, or recent history',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['me', 'dashboard', 'activity', 'history'],
          description: 'Action: me (user profile), dashboard (course cards), activity (activity stream), history (recent history)',
        },
      },
      required: ['baseUrl', 'apiKey', 'action'],
    },
  },

  // 14. get_course_overview
  {
    name: 'get_course_overview',
    description: 'Get a high-level course overview (pages, modules, assignments, syllabus) or module completion progress',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['content', 'progress'],
          description: 'Action: content (full course content overview), progress (module completion progress)',
        },
        courseId: { type: 'number', description: 'Course ID' },
      },
      required: ['baseUrl', 'apiKey', 'action', 'courseId'],
    },
  },

  // 15. get_syllabus
  {
    name: 'get_syllabus',
    description: 'Get the syllabus for a course. Returns the full syllabus body/content for the specified course. Use this when the user asks to read, view, or check a course syllabus.',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        courseId: { type: 'number', description: 'The Canvas course ID' },
      },
      required: ['baseUrl', 'apiKey', 'courseId'],
    },
  },

  // 16. get_conversations
  {
    name: 'get_conversations',
    description: 'Get inbox conversations: list all, details of one, or unread count',
    inputSchema: {
      type: 'object',
      properties: {
        ...credentialProps,
        action: {
          type: 'string',
          enum: ['list', 'details', 'unread'],
          description: 'Action: list (all conversations), details (single conversation), unread (unread count)',
        },
        conversationId: { type: 'number', description: 'Conversation ID (required for details)' },
      },
      required: ['baseUrl', 'apiKey', 'action'],
    },
  },
];

export const allTools: MCPTool[] = [...canvasTools];
