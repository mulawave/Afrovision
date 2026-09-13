package com.afrovision.tv

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import java.io.File

class TvApplication : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .crossfade(true)
            .allowHardware(false)
            .diskCache(DiskCache.Builder().directory(File(cacheDir, "image_cache")).build())
            .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.25).build() }
            .build()
    }
}
