allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    // Only redirect build dir if the subproject is on the same drive root as the
    // new build directory — Gradle cannot relativize paths across Windows drives.
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.afterEvaluate {
        val projectRoot = project.projectDir.toPath().root
        val buildRoot = newSubprojectBuildDir.asFile.toPath().root
        if (projectRoot == buildRoot) {
            project.layout.buildDirectory.value(newSubprojectBuildDir)
        }
        // Inject namespace for legacy plugins that only declare it in AndroidManifest
        project.plugins.withId("com.android.library") {
            val android = project.extensions.getByType(com.android.build.gradle.LibraryExtension::class.java)
            if (android.namespace.isNullOrEmpty()) {
                val manifest = project.file("src/main/AndroidManifest.xml")
                if (manifest.exists()) {
                    val pkg = Regex("""package\s*=\s*"([^"]+)"""").find(manifest.readText())?.groupValues?.get(1)
                    if (!pkg.isNullOrEmpty()) {
                        android.namespace = pkg
                    }
                }
            }
            // Force minimum compileSdk 34 so legacy plugins pick up android:attr/lStar etc.
            if (android.compileSdk != null && android.compileSdk!! < 34) {
                android.compileSdk = 34
            }
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
