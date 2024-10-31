import counterStore from "./counter"



class MobxStore {
    public store: { counterStore: typeof counterStore }
  
    constructor() {
      this.store = {
        counterStore
      }
    }
}

const mobxStore = new MobxStore()

export default mobxStore.store
    // public static instance() {
    //   if (process.env.TARO_ENV === 'alipay') {
    //     if (!my.mobxInstance) {
    //       my.mobxInstance = new MobxStore()
    //     }
    //     return my.mobxInstance
    //   }
    //   if (!MobxStore.mobxInstance) {
    //     MobxStore.mobxInstance = new MobxStore()
    //   }
    //   return MobxStore.mobxInstance
    // }
  
    // getStore() {
    //   return this.store
    // }

//   const store = new MobxStore()
//   export default store.store