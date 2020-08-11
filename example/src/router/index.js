import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from '../views/Home.vue';
import Info from '../views/Info.vue';

Vue.use(VueRouter);

const routes = [{
        path: '/',
        component: Home
    },
    {
        path: '/info',
        name: 'Info',
        component: Info
    },
    {
        path: '/about',
        name: 'About',
        // route level code-splitting
        // this generates a separate chunk (about.[hash].js) for this route
        // which is lazy-loaded when the route is visited.
        component: () =>
            import( /* webpackChunkName: 'about' */ '../views/About.vue')
    }
];

const router = new VueRouter({
    routes,
    mode: 'history',
    scrollBehavior(to, from, savePosition) {
        console.log(to, from, savePosition);
    }
});

export default router;