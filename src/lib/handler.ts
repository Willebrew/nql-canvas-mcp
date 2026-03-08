/**
 * Consolidated handler — 15 tools, each with action-based dispatch.
 */
import { CanvasAPI } from './canvas';

export async function handleCanvasTool(
  canvas: CanvasAPI,
  name: string,
  args: Record<string, unknown>
): Promise<{ data?: unknown; error?: string }> {
  let data: unknown;
  const action = args.action as string | undefined;

  switch (name) {
    // ===== 1. get_courses =====
    case 'get_courses': {
      switch (action) {
        case 'list':
          data = await canvas.getCourses();
          break;
        case 'details':
          data = await canvas.getCourseDetails(args.courseId as number);
          break;
        case 'syllabus':
          data = await canvas.getSyllabus(args.courseId as number);
          break;
        case 'settings':
          data = await canvas.getCourseSettings(args.courseId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_courses` };
      }
      break;
    }

    // ===== 2. get_assignments =====
    case 'get_assignments': {
      switch (action) {
        case 'list':
          data = await canvas.getAssignments(args.courseId as number);
          break;
        case 'details':
          data = await canvas.getAssignmentDetails(args.courseId as number, args.assignmentId as number);
          break;
        case 'groups':
          data = await canvas.getAssignmentGroups(args.courseId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_assignments` };
      }
      break;
    }

    // ===== 3. get_grades =====
    case 'get_grades': {
      switch (action) {
        case 'summary':
          data = await canvas.getGrades(args.courseId as number);
          break;
        case 'detailed':
          data = await canvas.getDetailedGrades(args.courseId as number);
          break;
        case 'submissions':
          data = await canvas.getSubmissions(args.courseId as number, args.assignmentId as number | undefined);
          break;
        case 'my_grades': {
          const gradeCourses = await canvas.getMyCourseGrades() as any[];
          data = gradeCourses
            .filter((c: any) => c.enrollments && c.enrollments.length > 0)
            .map((c: any) => {
              const enrollment = c.enrollments.find((e: any) => e.type === 'student') || c.enrollments[0];
              return {
                courseId: c.id,
                courseName: c.name,
                currentScore: enrollment?.computed_current_score ?? null,
                currentGrade: enrollment?.computed_current_grade ?? null,
                finalScore: enrollment?.computed_final_score ?? null,
                finalGrade: enrollment?.computed_final_grade ?? null,
              };
            });
          break;
        }
        default:
          return { error: `Unknown action '${action}' for get_grades` };
      }
      break;
    }

    // ===== 4. get_modules =====
    case 'get_modules': {
      switch (action) {
        case 'list':
          data = await canvas.getModules(args.courseId as number);
          break;
        case 'items':
          data = await canvas.getModuleItems(args.courseId as number, args.moduleId as number);
          break;
        case 'structure': {
          const modules = await canvas.getModules(args.courseId as number) as any[];
          data = {
            courseId: args.courseId,
            moduleCount: modules.length,
            structure: modules.map((mod: any) => ({
              id: mod.id,
              name: mod.name,
              position: mod.position,
              published: mod.published,
              itemCount: mod.items_count,
              items: (mod.items || []).map((item: any) => ({
                id: item.id,
                title: item.title,
                type: item.type,
                contentId: item.content_id,
                position: item.position,
                published: item.published,
              })),
            })),
          };
          break;
        }
        default:
          return { error: `Unknown action '${action}' for get_modules` };
      }
      break;
    }

    // ===== 5. get_pages =====
    case 'get_pages': {
      switch (action) {
        case 'list':
          data = await canvas.getPages(args.courseId as number);
          break;
        case 'content':
          data = await canvas.getPageContent(args.courseId as number, args.pageUrl as string);
          break;
        case 'front_page':
          data = await canvas.getFrontPage(args.courseId as number);
          break;
        case 'details': {
          const pageInfo = await canvas.getPageContent(args.courseId as number, args.pageUrl as string) as any;
          data = {
            title: pageInfo.title,
            url: pageInfo.url,
            createdAt: pageInfo.created_at,
            updatedAt: pageInfo.updated_at,
            lastEditedBy: pageInfo.last_edited_by,
            editingRoles: pageInfo.editing_roles,
            published: pageInfo.published,
            frontPage: pageInfo.front_page,
            locked: pageInfo.locked_for_user || false,
            lockExplanation: pageInfo.lock_explanation || null,
            bodyPreview: pageInfo.body ? pageInfo.body.replace(/<[^>]*>/g, '').substring(0, 200) : null,
          };
          break;
        }
        default:
          return { error: `Unknown action '${action}' for get_pages` };
      }
      break;
    }

    // ===== 6. get_announcements =====
    case 'get_announcements': {
      data = await canvas.getAnnouncements(args.courseId as number | undefined);
      break;
    }

    // ===== 7. get_discussions =====
    case 'get_discussions': {
      switch (action) {
        case 'list':
          data = await canvas.getDiscussions(args.courseId as number);
          break;
        case 'details':
          data = await canvas.getDiscussions(args.courseId as number, args.topicId as number);
          break;
        case 'entries':
          data = await canvas.getDiscussionEntries(args.courseId as number, args.topicId as number);
          break;
        case 'with_replies':
          data = await canvas.getDiscussionWithReplies(args.courseId as number, args.topicId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_discussions` };
      }
      break;
    }

    // ===== 8. get_calendar =====
    case 'get_calendar': {
      switch (action) {
        case 'events':
          data = await canvas.getCalendarEvents(
            args.courseId as number | undefined,
            args.startDate as string | undefined,
            args.endDate as string | undefined,
          );
          break;
        case 'upcoming':
          data = await canvas.getUpcomingEvents();
          break;
        default:
          return { error: `Unknown action '${action}' for get_calendar` };
      }
      break;
    }

    // ===== 9. get_todos =====
    case 'get_todos': {
      switch (action) {
        case 'list':
          data = await canvas.getTodoItems();
          break;
        case 'upcoming_assignments': {
          const daysAhead = (args.daysAhead as number) || 7;
          const now = new Date();
          const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
          const courses = await canvas.getCourses() as any[];
          const upcoming: any[] = [];
          const concurrency = 3;
          for (let i = 0; i < courses.length; i += concurrency) {
            const batch = courses.slice(i, i + concurrency);
            const results = await Promise.allSettled(
              batch.map(c => canvas.getAssignments(c.id))
            );
            for (let j = 0; j < results.length; j++) {
              if (results[j].status !== 'fulfilled') continue;
              const assignments = (results[j] as PromiseFulfilledResult<any>).value as any[];
              for (const a of assignments) {
                if (!a.due_at) continue;
                const dueDate = new Date(a.due_at);
                if (dueDate >= now && dueDate <= cutoff) {
                  upcoming.push({
                    courseId: batch[j].id,
                    courseName: batch[j].name,
                    assignmentId: a.id,
                    name: a.name,
                    dueAt: a.due_at,
                    pointsPossible: a.points_possible,
                    submissionTypes: a.submission_types,
                    hasSubmitted: a.has_submitted_submissions,
                  });
                }
              }
            }
          }
          upcoming.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
          data = { daysAhead, assignmentCount: upcoming.length, assignments: upcoming };
          break;
        }
        case 'missing':
          data = await canvas.getMissingSubmissions();
          break;
        default:
          return { error: `Unknown action '${action}' for get_todos` };
      }
      break;
    }

    // ===== 10. get_quizzes =====
    case 'get_quizzes': {
      switch (action) {
        case 'list':
          data = await canvas.getQuizzes(args.courseId as number);
          break;
        case 'submissions':
          data = await canvas.getQuizSubmissions(args.courseId as number, args.quizId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_quizzes` };
      }
      break;
    }

    // ===== 11. get_files =====
    case 'get_files': {
      switch (action) {
        case 'list':
          data = await canvas.getFiles(args.courseId as number, args.folderId as number | undefined);
          break;
        case 'details':
          data = await canvas.getFileDetails(args.courseId as number, args.fileId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_files` };
      }
      break;
    }

    // ===== 12. get_people =====
    case 'get_people': {
      switch (action) {
        case 'users':
          data = await canvas.getCourseUsers(args.courseId as number, args.enrollmentType as string | undefined);
          break;
        case 'sections':
          data = await canvas.getSections(args.courseId as number);
          break;
        case 'enrollments':
          data = await canvas.getEnrollments(args.courseId as number);
          break;
        case 'groups':
          data = await canvas.getCourseGroups(args.courseId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_people` };
      }
      break;
    }

    // ===== 13. get_profile =====
    case 'get_profile': {
      switch (action) {
        case 'me':
          data = await canvas.getUserProfile();
          break;
        case 'dashboard':
          data = await canvas.getDashboardCards();
          break;
        case 'activity':
          data = await canvas.getActivityStream();
          break;
        case 'history':
          data = await canvas.getRecentHistory();
          break;
        default:
          return { error: `Unknown action '${action}' for get_profile` };
      }
      break;
    }

    // ===== 14. get_course_overview =====
    case 'get_course_overview': {
      switch (action) {
        case 'content': {
          const [pages, modules, assignments, syllabus] = await Promise.all([
            canvas.getPages(args.courseId as number),
            canvas.getModules(args.courseId as number),
            canvas.getAssignments(args.courseId as number),
            canvas.getSyllabus(args.courseId as number),
          ]);
          data = {
            pages: { count: (pages as any[]).length, items: pages },
            modules: { count: (modules as any[]).length, items: modules },
            assignments: { count: (assignments as any[]).length, items: assignments },
            syllabus,
          };
          break;
        }
        case 'progress':
          data = await canvas.getCourseProgress(args.courseId as number);
          break;
        default:
          return { error: `Unknown action '${action}' for get_course_overview` };
      }
      break;
    }

    // ===== 15. get_conversations =====
    case 'get_conversations': {
      switch (action) {
        case 'list':
          data = await canvas.getConversations();
          break;
        case 'details':
          data = await canvas.getConversationDetails(args.conversationId as number);
          break;
        case 'unread':
          data = await canvas.getUnreadCount();
          break;
        default:
          return { error: `Unknown action '${action}' for get_conversations` };
      }
      break;
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }

  return { data };
}
