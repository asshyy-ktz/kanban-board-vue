import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'boards',
      component: () => import('@/views/BoardListView.vue'),
    },
    {
      path: '/boards/:boardId',
      name: 'board',
      component: () => import('@/views/BoardView.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
