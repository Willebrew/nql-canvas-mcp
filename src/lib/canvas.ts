export interface CanvasConfig {
  baseUrl: string;
  apiKey: string;
}

export class CanvasAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: CanvasConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ===== RETRY LOGIC =====
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, options);

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    }

    // Should not reach here, but satisfy TypeScript
    return fetch(url, options);
  }

  // ===== CORE REQUEST METHODS (with retry) =====
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await this.fetchWithRetry(url, { headers: this.headers });
    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async makePostRequest<T>(endpoint: string, data: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Canvas API error: ${response.status} ${response.statusText} ${errorText}`);
    }
    return response.json();
  }

  private async makePutRequest<T>(endpoint: string, data: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Canvas API error: ${response.status} ${response.statusText} ${errorText}`);
    }
    return response.json();
  }

  private async makeDeleteRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Canvas API error: ${response.status} ${response.statusText} ${errorText}`);
    }
    return response.json();
  }

  // ===== PAGINATION =====
  private async makePaginatedRequest<T>(endpoint: string, perPage = 100, maxPages = 50): Promise<T[]> {
    const results: T[] = [];
    const separator = endpoint.includes('?') ? '&' : '?';

    for (let page = 1; page <= maxPages; page++) {
      const url = `${this.baseUrl}/api/v1${endpoint}${separator}per_page=${perPage}&page=${page}`;
      const response = await this.fetchWithRetry(url, { headers: this.headers });
      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }
      const data: T[] = await response.json();
      results.push(...data);
      if (data.length < perPage) break;
    }

    return results;
  }

  // ===== COURSES (READ) =====
  async getCourses() { return this.makePaginatedRequest('/users/self/favorites/courses'); }
  async getCourseDetails(courseId: number) { return this.makeRequest(`/courses/${courseId}?include[]=syllabus_body&include[]=total_scores`); }
  async getSyllabus(courseId: number) { return this.makeRequest(`/courses/${courseId}?include[]=syllabus_body`); }
  async getCourseSettings(courseId: number) { return this.makeRequest(`/courses/${courseId}/settings`); }
  async getCourseUsers(courseId: number, enrollmentType?: string) {
    let endpoint = `/courses/${courseId}/users?include[]=enrollments&include[]=email`;
    if (enrollmentType) endpoint += `&enrollment_type[]=${enrollmentType}`;
    return this.makePaginatedRequest(endpoint);
  }
  async getSections(courseId: number) { return this.makeRequest(`/courses/${courseId}/sections`); }
  async getEnrollments(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/enrollments`); }
  async getAssignmentGroups(courseId: number) { return this.makeRequest(`/courses/${courseId}/assignment_groups?include[]=assignments`); }
  async getCourseOutcomes(courseId: number) { return this.makeRequest(`/courses/${courseId}/outcomes`); }
  async getExternalTools(courseId: number) { return this.makeRequest(`/courses/${courseId}/external_tools`); }

  // ===== ASSIGNMENTS (CRUD) =====
  async getAssignments(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/assignments?include[]=all_dates&include[]=submission`); }
  async getAssignmentDetails(courseId: number, assignmentId: number) { return this.makeRequest(`/courses/${courseId}/assignments/${assignmentId}`); }
  async createAssignment(courseId: number, data: Record<string, unknown>) {
    return this.makePostRequest(`/courses/${courseId}/assignments`, { assignment: data });
  }
  async updateAssignment(courseId: number, assignmentId: number, data: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/assignments/${assignmentId}`, { assignment: data });
  }

  // ===== SUBMISSIONS & GRADING =====
  async getSubmissions(courseId: number, assignmentId?: number) {
    return assignmentId
      ? this.makePaginatedRequest(`/courses/${courseId}/assignments/${assignmentId}/submissions`)
      : this.makePaginatedRequest(`/courses/${courseId}/students/submissions`);
  }
  async getGrades(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/enrollments?type[]=StudentEnrollment&include[]=grades`); }
  async getDetailedGrades(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/assignments?include[]=submission`); }
  async gradeSubmission(courseId: number, assignmentId: number, userId: number, data: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, data);
  }

  // ===== BULK GRADING =====
  async bulkGradeSubmissions(
    courseId: number,
    assignmentId: number,
    grades: Array<{ userId: number; score: number; comment?: string }>
  ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
    const concurrency = 3;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < grades.length; i += concurrency) {
      const batch = grades.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(g => {
          const data: Record<string, unknown> = {};
          data.submission = { posted_grade: g.score };
          if (g.comment) data.comment = { text_comment: g.comment };
          return this.gradeSubmission(courseId, assignmentId, g.userId, data);
        })
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          succeeded++;
        } else {
          failed++;
          errors.push(`User ${batch[j].userId}: ${(results[j] as PromiseRejectedResult).reason}`);
        }
      }
    }

    return { succeeded, failed, errors };
  }

  // ===== DISCUSSIONS (CRUD) =====
  async getDiscussions(courseId: number, topicId?: number) {
    return topicId
      ? this.makeRequest(`/courses/${courseId}/discussion_topics/${topicId}`)
      : this.makePaginatedRequest(`/courses/${courseId}/discussion_topics`);
  }
  async getDiscussionEntries(courseId: number, topicId: number) {
    return this.makePaginatedRequest(`/courses/${courseId}/discussion_topics/${topicId}/entries`);
  }
  async createDiscussionTopic(courseId: number, data: Record<string, unknown>) {
    return this.makePostRequest(`/courses/${courseId}/discussion_topics`, data);
  }
  async postDiscussionEntry(courseId: number, topicId: number, message: string) {
    return this.makePostRequest(`/courses/${courseId}/discussion_topics/${topicId}/entries`, { message });
  }
  async replyToDiscussionEntry(courseId: number, topicId: number, entryId: number, message: string) {
    return this.makePostRequest(`/courses/${courseId}/discussion_topics/${topicId}/entries/${entryId}/replies`, { message });
  }
  async deleteDiscussionTopic(courseId: number, topicId: number) {
    return this.makeDeleteRequest(`/courses/${courseId}/discussion_topics/${topicId}`);
  }

  // ===== ANNOUNCEMENTS =====
  async getAnnouncements(courseId?: number) {
    return courseId
      ? this.makePaginatedRequest(`/courses/${courseId}/discussion_topics?only_announcements=true`)
      : this.makePaginatedRequest('/announcements');
  }
  async createAnnouncement(courseId: number, title: string, message: string, isPublished: boolean = true) {
    return this.makePostRequest(`/courses/${courseId}/discussion_topics`, {
      title,
      message,
      is_announcement: true,
      published: isPublished,
    });
  }
  async deleteAnnouncement(courseId: number, topicId: number) {
    return this.makeDeleteRequest(`/courses/${courseId}/discussion_topics/${topicId}`);
  }

  // ===== MODULES (CRUD) =====
  async getModules(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/modules?include[]=items`); }
  async getModuleItems(courseId: number, moduleId: number) {
    return this.makePaginatedRequest(`/courses/${courseId}/modules/${moduleId}/items?include[]=content_details`);
  }
  async createModule(courseId: number, data: Record<string, unknown>) {
    return this.makePostRequest(`/courses/${courseId}/modules`, { module: data });
  }
  async updateModule(courseId: number, moduleId: number, data: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/modules/${moduleId}`, { module: data });
  }
  async deleteModule(courseId: number, moduleId: number) {
    return this.makeDeleteRequest(`/courses/${courseId}/modules/${moduleId}`);
  }
  async addModuleItem(courseId: number, moduleId: number, data: Record<string, unknown>) {
    return this.makePostRequest(`/courses/${courseId}/modules/${moduleId}/items`, { module_item: data });
  }
  async updateModuleItem(courseId: number, moduleId: number, itemId: number, data: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/modules/${moduleId}/items/${itemId}`, { module_item: data });
  }
  async deleteModuleItem(courseId: number, moduleId: number, itemId: number) {
    return this.makeDeleteRequest(`/courses/${courseId}/modules/${moduleId}/items/${itemId}`);
  }

  // ===== PAGES (CRUD) =====
  async getPages(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/pages`); }
  async getPageContent(courseId: number, pageUrl: string) { return this.makeRequest(`/courses/${courseId}/pages/${pageUrl}`); }
  async getFrontPage(courseId: number) { return this.makeRequest(`/courses/${courseId}/front_page`); }
  async createPage(courseId: number, data: Record<string, unknown>) {
    return this.makePostRequest(`/courses/${courseId}/pages`, { wiki_page: data });
  }
  async editPageContent(courseId: number, pageUrl: string, data: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/pages/${pageUrl}`, { wiki_page: data });
  }
  async deletePage(courseId: number, pageUrl: string) {
    return this.makeDeleteRequest(`/courses/${courseId}/pages/${pageUrl}`);
  }

  // ===== RUBRICS (CRUD) =====
  async getRubrics(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/rubrics`); }
  async getRubricDetails(courseId: number, rubricId: number) { return this.makeRequest(`/courses/${courseId}/rubrics/${rubricId}?include[]=assessments`); }
  async createRubric(courseId: number, data: Record<string, unknown>) {
    return this.makePostRequest(`/courses/${courseId}/rubrics`, data);
  }
  async updateRubric(courseId: number, rubricId: number, data: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/rubrics/${rubricId}`, { rubric: data });
  }
  async deleteRubric(courseId: number, rubricId: number) {
    return this.makeDeleteRequest(`/courses/${courseId}/rubrics/${rubricId}`);
  }

  // ===== FILES =====
  async getFiles(courseId: number, folderId?: number) {
    return folderId
      ? this.makePaginatedRequest(`/folders/${folderId}/files`)
      : this.makePaginatedRequest(`/courses/${courseId}/files`);
  }
  async getFileDetails(courseId: number, fileId: number) {
    return this.makeRequest(`/courses/${courseId}/files/${fileId}`);
  }

  // ===== QUIZZES =====
  async getQuizzes(courseId: number) { return this.makePaginatedRequest(`/courses/${courseId}/quizzes`); }
  async getQuizSubmissions(courseId: number, quizId: number) { return this.makeRequest(`/courses/${courseId}/quizzes/${quizId}/submissions`); }

  // ===== CONVERSATIONS / MESSAGING =====
  async getConversations() { return this.makePaginatedRequest('/conversations'); }
  async getConversationDetails(conversationId: number) { return this.makeRequest(`/conversations/${conversationId}`); }
  async getUnreadCount() { return this.makeRequest('/conversations/unread_count'); }
  async sendConversation(data: Record<string, unknown>) {
    return this.makePostRequest('/conversations', data);
  }

  // ===== GROUPS =====
  async getGroups() { return this.makeRequest('/users/self/groups'); }
  async getCourseGroups(courseId: number) { return this.makeRequest(`/courses/${courseId}/groups`); }

  // ===== CALENDAR =====
  async getCalendarEvents(courseId?: number, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (courseId) params.append('context_codes[]', `course_${courseId}`);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return this.makePaginatedRequest(`/calendar_events${params.toString() ? '?' + params.toString() : ''}`);
  }

  // ===== USER / SELF =====
  async getUserProfile() { return this.makeRequest('/users/self/profile'); }
  async getActivityStream() { return this.makeRequest('/users/self/activity_stream'); }
  async getDashboardCards() { return this.makeRequest('/dashboard/dashboard_cards'); }
  async getTodoItems() { return this.makeRequest('/users/self/todo'); }
  async getUpcomingEvents() { return this.makeRequest('/users/self/upcoming_events'); }
  async getMissingSubmissions(userId?: number) { return this.makeRequest(userId ? `/users/${userId}/missing_submissions` : '/users/self/missing_submissions'); }
  async getFavoriteCourses() { return this.makeRequest('/users/self/favorites/courses'); }
  async getRecentHistory() { return this.makeRequest('/users/self/history'); }
  async getCourseProgress(courseId: number) { return this.makeRequest(`/courses/${courseId}/modules?include[]=items&include[]=completion_requirements`); }

  // ===== PEER REVIEWS =====
  async getPeerReviews(courseId: number, assignmentId: number) {
    return this.makePaginatedRequest(`/courses/${courseId}/assignments/${assignmentId}/peer_reviews`);
  }
  async assignPeerReview(courseId: number, assignmentId: number, userId: number, reviewerId: number) {
    return this.makePostRequest(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}/peer_reviews`,
      { user_id: reviewerId }
    );
  }

  // ===== SUBMISSIONS WITH COMMENTS =====
  async getSubmissionsWithComments(courseId: number, assignmentId: number) {
    return this.makePaginatedRequest(
      `/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=submission_comments`
    );
  }

  // ===== FILE UPLOAD (3-step Canvas process) =====
  async uploadCourseFile(
    courseId: number,
    fileName: string,
    fileContent: string,
    contentType: string,
    folderPath?: string
  ) {
    // Step 1: Request upload URL
    const step1Data: Record<string, unknown> = {
      name: fileName,
      content_type: contentType,
    };
    if (folderPath) step1Data.parent_folder_path = folderPath;

    const step1 = await this.makePostRequest<{
      upload_url: string;
      upload_params: Record<string, string>;
    }>(`/courses/${courseId}/files`, step1Data);

    // Step 2: POST file content to upload_url
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(step1.upload_params)) {
      formData.append(key, value);
    }
    // Decode base64 content and send as file
    const binaryContent = atob(fileContent);
    const bytes = new Uint8Array(binaryContent.length);
    for (let i = 0; i < binaryContent.length; i++) {
      bytes[i] = binaryContent.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: contentType });

    const form = new FormData();
    for (const [key, value] of Object.entries(step1.upload_params)) {
      form.append(key, value);
    }
    form.append('file', blob, fileName);

    const step2Response = await fetch(step1.upload_url, {
      method: 'POST',
      body: form,
    });
    if (!step2Response.ok && step2Response.status !== 301 && step2Response.status !== 302) {
      throw new Error(`File upload step 2 failed: ${step2Response.status}`);
    }

    // Step 3: Confirm (some Canvas instances return the file object directly, others redirect)
    if (step2Response.status === 301 || step2Response.status === 302) {
      const confirmUrl = step2Response.headers.get('Location');
      if (confirmUrl) {
        const confirmResponse = await fetch(confirmUrl, { headers: this.headers });
        return confirmResponse.json();
      }
    }
    return step2Response.json();
  }

  // ===== FILE DOWNLOAD URL =====
  async getFileDownloadUrl(courseId: number, fileId: number) {
    return this.makeRequest(`/courses/${courseId}/files/${fileId}`);
  }

  // ===== RUBRIC EXTENDED OPERATIONS =====
  async getAssignmentWithRubric(courseId: number, assignmentId: number) {
    return this.makeRequest(`/courses/${courseId}/assignments/${assignmentId}?include[]=rubric`);
  }

  async getSubmissionRubricAssessment(courseId: number, assignmentId: number, userId: number) {
    return this.makeRequest(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}?include[]=rubric_assessment`
    );
  }

  async gradeWithRubric(
    courseId: number,
    assignmentId: number,
    userId: number,
    rubricAssessment: Record<string, unknown>
  ) {
    return this.makePutRequest(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      { rubric_assessment: rubricAssessment }
    );
  }

  async associateRubricWithAssignment(
    courseId: number,
    rubricId: number,
    assignmentId: number,
    useForGrading = false
  ) {
    return this.makePostRequest(`/courses/${courseId}/rubric_associations`, {
      rubric_association: {
        rubric_id: rubricId,
        association_id: assignmentId,
        association_type: 'Assignment',
        use_for_grading: useForGrading,
        purpose: 'grading',
      },
    });
  }

  // ===== ANNOUNCEMENT BULK DELETE =====
  async bulkDeleteAnnouncements(
    courseId: number,
    topicIds: number[]
  ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
    const concurrency = 3;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < topicIds.length; i += concurrency) {
      const batch = topicIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(id => this.deleteAnnouncement(courseId, id))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          succeeded++;
        } else {
          failed++;
          errors.push(`Topic ${batch[j]}: ${(results[j] as PromiseRejectedResult).reason}`);
        }
      }
    }

    return { succeeded, failed, errors };
  }

  // ===== MARK CONVERSATIONS READ =====
  async markConversationsRead(conversationIds: number[]) {
    return this.makePutRequest('/conversations', {
      conversation_ids: conversationIds,
      event: 'mark_as_read',
    });
  }

  // ===== DISCUSSION WITH REPLIES =====
  async getDiscussionWithReplies(courseId: number, topicId: number) {
    const [topic, entries] = await Promise.all([
      this.makeRequest(`/courses/${courseId}/discussion_topics/${topicId}`),
      this.makePaginatedRequest<any>(`/courses/${courseId}/discussion_topics/${topicId}/entries`),
    ]);

    // Fetch replies for each entry (concurrency=3)
    const concurrency = 3;
    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(entry =>
          this.makePaginatedRequest(`/courses/${courseId}/discussion_topics/${topicId}/entries/${entry.id}/replies`)
            .catch(() => [])
        )
      );
      for (let j = 0; j < results.length; j++) {
        batch[j].replies = results[j].status === 'fulfilled' ? (results[j] as PromiseFulfilledResult<unknown[]>).value : [];
      }
    }

    return { topic, entries };
  }

  // ===== PAGE SETTINGS UPDATE =====
  async updatePageSettings(courseId: number, pageUrl: string, settings: Record<string, unknown>) {
    return this.makePutRequest(`/courses/${courseId}/pages/${pageUrl}`, { wiki_page: settings });
  }

  // ===== STUDENT-SELF: MY COURSE GRADES =====
  async getMyCourseGrades() {
    return this.makePaginatedRequest('/courses?include[]=total_scores&enrollment_state=active');
  }

  // ===== DISCUSSION ENTRY DETAIL =====
  async getDiscussionEntryReplies(courseId: number, topicId: number, entryId: number) {
    return this.makePaginatedRequest(
      `/courses/${courseId}/discussion_topics/${topicId}/entries/${entryId}/replies`
    );
  }
}
