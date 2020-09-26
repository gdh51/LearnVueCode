<template>
    <div id="app">
        <div id="nav">
            <router-link to="/">Home</router-link>|
            <router-link to="/about">About</router-link>|
            <router-link to="/info">Info</router-link>|
            <router-link to="/ab">About</router-link>|
            <router-link :to="{ params: '/a' }">Child Path /a</router-link>
        </div>
        <router-view />
    </div>
</template>

<script>
import moment from 'moment'
export default {
    created() {
        console.log(
            moment('06:00', 'HH:mm').isBetween(
                moment('07:00', 'HH:mm'),
                moment('13:00', 'HH:mm')
            )
        )
    }
}
</script>

<style lang="stylus">
#app
    margin-top 60px
    color #2c3e50
    text-align center
    font-family Avenir, Helvetica, Arial, sans-serif
    -webkit-font-smoothing antialiased
    -moz-osx-font-smoothing grayscale
</style>
